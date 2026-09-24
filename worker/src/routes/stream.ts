import { Hono, type Context } from 'hono';
import { getInnertube } from '../innertube.js';
import { muxToMp4 } from '../mux.js';
import { mintPoToken } from '../po-token.js';

export const stream = new Hono();

interface PlayerLike {
  decipher(player: unknown): Promise<string>;
}

interface StreamFormat extends PlayerLike {
  itag: number;
  mime_type: string;
  content_length?: number;
  is_original?: boolean;
}

interface FormatChooser {
  chooseFormat(options: { type: 'video+audio' | 'video' | 'audio'; quality: string }): StreamFormat;
}

/** Tries to find a single combined video+audio format; null if none exists. */
function findCombinedFormat(details: FormatChooser): StreamFormat | null {
  try {
    return details.chooseFormat({ type: 'video+audio', quality: 'best' });
  } catch {
    return null;
  }
}

/**
 * youtubei.js's own chooseFormat({ itag }) just returns the first format
 * whose itag matches — but YouTube reuses the same itag number across every
 * dub language for a video (itag 140 might be ~20 different audio tracks,
 * one per language), so "first match" can silently be the wrong language
 * (observed: Arabic, since it sorts first). Disambiguate explicitly by
 * preferring the original/undubbed track whenever an itag is shared.
 */
function findFormatByItag(
  details: { streaming_data?: { formats?: StreamFormat[]; adaptive_formats?: StreamFormat[] } },
  itag: number,
): StreamFormat {
  const all = [...(details.streaming_data?.formats ?? []), ...(details.streaming_data?.adaptive_formats ?? [])];
  const candidates = all.filter((f) => f.itag === itag);
  if (candidates.length === 0) throw new Error('No matching formats found');
  return candidates.find((f) => f.is_original) ?? candidates[0];
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 150);
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return mimeType.includes('audio') ? 'm4a' : 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'bin';
}

// googlevideo throttles requests with no bounded Range header down to
// roughly real-time playback speed instead of failing outright — confirmed
// empirically (an unbounded fetch of a 3.4MB file crawled at ~32KB/s).
// Every upstream request this worker makes is therefore bounded and
// chunked internally when the caller wants more than one piece; the client
// (dash.js or a plain download) never sees the difference.
const MAX_UPSTREAM_CHUNK = 4 * 1024 * 1024;

/**
 * Fetches one bounded range of a format's bytes, appending a po_token —
 * modern YouTube requires one on CDN requests, matched to the same
 * visitorData the Innertube session was created with (see innertube.ts /
 * po-token.ts) — a mismatched or absent token only grants YouTube's brief
 * "cold start" allowance (confirmed empirically: ~1-1.3MB of any stream,
 * then a hard 403, regardless of chunk size or retries). Retries once with
 * a freshly-minted token in case of a one-off rejection.
 */
async function fetchRangeOnce(
  id: string,
  format: StreamFormat,
  player: unknown,
  poToken: string,
  range: { start: number; end: number },
): Promise<Response> {
  const attempt = async (token: string): Promise<Response> => {
    const deciphered = await format.decipher(player);
    const url = `${deciphered}&pot=${token}`;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
      Range: `bytes=${range.start}-${range.end}`,
    };
    return fetch(url, { headers });
  };

  let res = await attempt(poToken);
  if (!res.ok) {
    const freshToken = await mintPoToken(id, true);
    res = await attempt(freshToken);
  }
  if (!res.ok) throw new Error(`CDN responded ${res.status}`);
  return res;
}

/** Last-resort fallback for the rare format with no known content_length — can't be chunked without a known end, so this one request is left unbounded (and may be throttled). */
async function fetchRangeUnbounded(format: StreamFormat, player: unknown, poToken: string): Promise<Response> {
  const deciphered = await format.decipher(player);
  const url = `${deciphered}&pot=${poToken}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`CDN responded ${res.status}`);
  return res;
}

/**
 * Streams an arbitrarily large range by internally fetching it in bounded
 * MAX_UPSTREAM_CHUNK-sized pieces and concatenating them, so the CDN never
 * sees a single unbounded request to throttle.
 */
function fetchFormatBody(
  id: string,
  format: StreamFormat,
  player: unknown,
  poToken: string,
  range: { start: number; end: number },
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let cursor = range.start;
        while (cursor <= range.end) {
          const chunkEnd = Math.min(cursor + MAX_UPSTREAM_CHUNK - 1, range.end);
          const res = await fetchRangeOnce(id, format, player, poToken, { start: cursor, end: chunkEnd });
          if (!res.body) throw new Error('No response body from CDN');
          const reader = res.body.getReader();
          let received = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            received += value.byteLength;
          }
          if (received === 0) break; // avoid looping forever if a chunk genuinely comes back empty
          cursor += received;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

stream.get('/', async (c) => {
  const id = c.req.query('id')?.trim();
  const mode = c.req.query('mode') === 'music' ? 'music' : 'video';
  const itagParam = c.req.query('itag');
  const download = c.req.query('download') === '1';
  const kind = c.req.query('kind') === 'audio' || mode === 'music' ? 'audio' : 'video';
  const isLiveProxy = c.req.query('live') === '1';
  const cdnUrl = c.req.query('cdn')?.trim();

  if (!id) {
    return c.json({ error: 'Missing required query param: id' }, 400);
  }

  // Live DASH segment proxy: the rewritten official live MPD points media
  // URLs here with ?live=1&cdn=<original googlevideo URL>. We re-fetch that
  // URL with a fresh po_token so the browser never talks to the CDN directly
  // (CORS + token requirements).
  if (isLiveProxy && cdnUrl) {
    try {
      if (!/^https?:\/\/[^/]*(googlevideo\.com|youtube\.com)\//i.test(cdnUrl)) {
        return c.json({ error: 'Invalid CDN host' }, 400);
      }
      const poToken = await mintPoToken(id);
      const rangeHeader = c.req.header('range');
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0',
      };
      const target = new URL(cdnUrl);
      if (!target.searchParams.has('pot')) {
        target.searchParams.set('pot', poToken);
      }
      if (rangeHeader) headers['Range'] = rangeHeader;

      let res = await fetch(target.toString(), { headers });
      if (!res.ok) {
        const fresh = await mintPoToken(id, true);
        target.searchParams.set('pot', fresh);
        res = await fetch(target.toString(), { headers });
      }
      if (!res.ok || !res.body) {
        return c.json({ error: `CDN responded ${res.status}` }, 502);
      }

      const outHeaders = new Headers({
        'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      const contentRange = res.headers.get('content-range');
      const contentLength = res.headers.get('content-length');
      if (contentRange) outHeaders.set('Content-Range', contentRange);
      if (contentLength) outHeaders.set('Content-Length', contentLength);

      return new Response(res.body, {
        status: res.status,
        headers: outHeaders,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: `Live segment proxy failed: ${message}` }, 502);
    }
  }

  const yt = await getInnertube();

  try {
    const poToken = await mintPoToken(id);
    const details =
      mode === 'music' ? await yt.music.getInfo(id) : await yt.getInfo(id, { client: 'MWEB', po_token: poToken });
    const player = yt.session.player;
    const title = sanitizeFilename(details.basic_info.title ?? id);

    // Explicit itag always wins (used by the "pick a quality" UI, and for
    // audio/music downloads which are always a single stream already).
    if (itagParam) {
      const format = findFormatByItag(details, Number(itagParam));
      return await passthrough(c, id, format, player, poToken, { download, title });
    }

    if (kind === 'audio') {
      const format = details.chooseFormat({ type: 'audio', quality: 'best' });
      return await passthrough(c, id, format, player, poToken, { download, title });
    }

    // Video: prefer a single combined stream when YouTube actually serves
    // one (rare above ~360p); otherwise mux video-only + audio-only with
    // ffmpeg so the download is a normal watchable file.
    const combined = findCombinedFormat(details);
    if (combined) {
      return await passthrough(c, id, combined, player, poToken, { download, title });
    }

    if (!download) {
      // No combined format for inline playback: fall back to silent
      // video-only rather than paying the muxing cost on every page view.
      const videoOnly = details.chooseFormat({ type: 'video', quality: 'best' });
      return await passthrough(c, id, videoOnly, player, poToken, { download, title });
    }

    const videoFormat = details.chooseFormat({ type: 'video', quality: 'best' });
    const audioFormat = details.chooseFormat({ type: 'audio', quality: 'best' });
    if (videoFormat.content_length === undefined || audioFormat.content_length === undefined) {
      throw new Error('Format is missing a content length, cannot stream');
    }
    const videoBody = fetchFormatBody(id, videoFormat, player, poToken, {
      start: 0,
      end: videoFormat.content_length - 1,
    });
    const audioBody = fetchFormatBody(id, audioFormat, player, poToken, {
      start: 0,
      end: audioFormat.content_length - 1,
    });
    const muxed = await muxToMp4(videoBody, audioBody);

    return new Response(muxed, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${title}.mp4"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: `Failed to stream: ${message}` }, 502);
  }
});

async function passthrough(
  c: Context,
  id: string,
  format: StreamFormat,
  player: unknown,
  poToken: string,
  opts: { download: boolean; title: string },
): Promise<Response> {
  const rangeHeader = c.req.header('range');
  const total = format.content_length;

  // The range actually reported back to the client (drives 200 vs 206 and
  // the Content-Range header) — undefined when the client didn't ask.
  let clientRange: { start: number; end: number } | undefined;
  if (rangeHeader && total) {
    const match = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : total - 1;
      clientRange = { start, end };
    }
  }

  const headers = new Headers({
    'Content-Type': format.mime_type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  });

  let body: ReadableStream<Uint8Array>;
  if (total !== undefined) {
    // Always fetch upstream via the bounded/chunked path — even a "give me
    // the whole file" request from the client gets internally split into
    // fast bounded chunks rather than forwarded as one throttled request.
    const fetchRange = clientRange ?? { start: 0, end: total - 1 };
    body = fetchFormatBody(id, format, player, poToken, fetchRange);
    if (clientRange) {
      headers.set('Content-Range', `bytes ${clientRange.start}-${clientRange.end}/${total}`);
      headers.set('Content-Length', String(clientRange.end - clientRange.start + 1));
    } else {
      headers.set('Content-Length', String(total));
    }
  } else {
    // Rare: format has no known content length, so we can't pre-compute a
    // bounded range. Fall back to a single unbounded upstream fetch.
    const res = await fetchRangeUnbounded(format, player, poToken);
    if (!res.body) throw new Error('No response body from CDN');
    body = res.body;
  }

  if (opts.download) {
    const ext = extensionFor(format.mime_type);
    headers.set('Content-Disposition', `attachment; filename="${opts.title}.${ext}"`);
  }

  return new Response(body, {
    status: clientRange ? 206 : 200,
    headers,
  });
}
