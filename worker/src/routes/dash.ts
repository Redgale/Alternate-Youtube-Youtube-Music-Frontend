import { Hono } from 'hono';
import { getInnertube } from '../innertube.js';
import { mintPoToken } from '../po-token.js';

export const dash = new Hono();

interface FilterableFormat {
  drm_families?: string[];
  is_dubbed?: boolean;
  is_auto_dubbed?: boolean;
  is_original?: boolean;
  has_audio: boolean;
<<<<<<< HEAD
  itag?: number;
=======
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
}

/**
 * We have no DRM license support, so DRM-protected representations would
 * just show a gray screen (EME unsupported) — drop them. Also drop dubbed
 * audio tracks: YouTube's auto-dub feature adds extra AdaptationSets for
 * other languages alongside the original, and without an explicit
 * preference dash.js can pick one of those instead of the original.
 */
function shouldReject(format: FilterableFormat): boolean {
  if (format.drm_families && format.drm_families.length > 0) return true;
  if (format.has_audio && (format.is_dubbed || format.is_auto_dubbed) && !format.is_original) return true;
  return false;
}

<<<<<<< HEAD
type InnerTubeClient = 'MWEB' | 'TV' | 'ANDROID' | 'WEB';

/**
 * MWEB is preferred for full-length VOD (avoids the classic ~20 min
 * streaming-data truncation on some clients). Fall back through TV and
 * ANDROID when chooseFormat / toDash fails so long videos and edge-case
 * formats still resolve.
 */
const CLIENT_FALLBACKS: InnerTubeClient[] = ['MWEB', 'TV', 'ANDROID'];

=======
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
/**
 * Generates a DASH manifest for a video, with every representation's URL
 * rewritten to point back at our own /api/stream proxy instead of the raw
 * googlevideo CDN URL. This is how video playback avoids the YouTube
 * iframe embed entirely (same reason music moved off it): some videos
 * have embedding disabled by the uploader, which blocks the iframe player
 * outright but has no bearing on fetching the stream directly the way the
 * download button already does. dash.js (MSE) plays this manifest with
 * real video+audio sync, using our proxy's existing Range-request support
 * for seeking.
<<<<<<< HEAD
 *
 * Livestreams: youtubei.js's toDash() throws for is_live content. For those
 * we proxy YouTube's own dash_manifest_url (when present) after rewriting
 * BaseURL / media URLs through our stream endpoint so CORS and po_token
 * stay under our control. Pure HLS-only lives are reported clearly so the
 * frontend can surface a useful message.
=======
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
 */
dash.get('/', async (c) => {
  const id = c.req.query('id')?.trim();
  if (!id) return c.json({ error: 'Missing required query param: id' }, 400);

  const proto = c.req.header('x-forwarded-proto') ?? 'http';
  const host = c.req.header('host') ?? 'localhost';
  const origin = `${proto}://${host}`;
  const streamPath = c.req.path.replace(/\/api\/dash$/, '/api/stream');

  const yt = await getInnertube();
<<<<<<< HEAD
  const poToken = await mintPoToken(id);

  let lastError: unknown = null;

  for (const client of CLIENT_FALLBACKS) {
    try {
      const info = await yt.getInfo(id, { client, po_token: poToken });
      const basic = info.basic_info;
      const isLive = !!(basic.is_live || basic.is_live_content);

      // --- Live / post-live DVR -------------------------------------------
      if (isLive) {
        const officialDash = info.streaming_data?.dash_manifest_url;
        const officialHls = info.streaming_data?.hls_manifest_url;

        if (officialDash) {
          // Fetch YouTube's live MPD and rewrite every media URL so the
          // browser never talks to googlevideo directly (CORS + pot).
          const mpdRes = await fetch(officialDash, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (!mpdRes.ok) {
            throw new Error(`Official live DASH fetch failed: ${mpdRes.status}`);
          }
          let mpd = await mpdRes.text();

          // Rewrite absolute googlevideo / youtube URLs that appear as
          // BaseURL or media= attributes into our stream proxy. Live
          // segments are identified by the full CDN URL rather than an
          // itag, so we pass the original URL as a query param.
          const proxyBase = new URL(streamPath, origin);
          proxyBase.searchParams.set('id', id);
          proxyBase.searchParams.set('mode', 'video');
          proxyBase.searchParams.set('live', '1');

          mpd = mpd.replace(
            /(https?:\/\/[^"'<> \t\n]+(?:googlevideo\.com|youtube\.com)[^"'<> \t\n]*)/gi,
            (cdnUrl) => {
              const proxied = new URL(proxyBase.toString());
              proxied.searchParams.set('cdn', cdnUrl);
              return proxied.toString().replace(/&/g, '&amp;');
            },
          );

          return c.body(mpd, 200, {
            'Content-Type': 'application/dash+xml',
            'Cache-Control': 'no-store',
          });
        }

        if (officialHls) {
          // HLS-only live: return structured error so the frontend can
          // show a clear message (or later add hls.js). We still expose
          // the URL for debugging.
          return c.json(
            {
              error: 'This livestream only provides HLS (no DASH). HLS playback is not yet supported in this player.',
              isLive: true,
              hlsManifestUrl: officialHls,
            },
            501,
          );
        }

        throw new Error('Live video has no usable dash_manifest_url or hls_manifest_url');
      }

      // --- VOD (including long videos) ------------------------------------
      // Serve exactly one video + one audio representation rather than a
      // full quality ladder. dash.js's startup ABR probing fires
      // near-simultaneous requests across every representation, which
      // reads as bot-like traffic to YouTube and was triggering 403s from
      // the CDN — a single representation each means there's nothing to
      // probe between.
      // 'best' rather than a fixed '1080p' label: the MWEB client (needed
      // for full-length playback) caps out well below 1080p for plenty of
      // videos, and an exact-label request throws outright when that
      // label doesn't exist rather than falling back.
      const videoFormat = info.chooseFormat({ type: 'video', quality: 'best' });
      const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
      const keepItags = new Set([videoFormat.itag, audioFormat.itag]);

      const manifest = await info.toDash({
        url_transformer: (url) => {
          const itag = url.searchParams.get('itag');
          const proxied = new URL(streamPath, origin);
          proxied.searchParams.set('id', id);
          proxied.searchParams.set('mode', 'video');
          if (itag) proxied.searchParams.set('itag', itag);
          return proxied;
        },
        format_filter: (format: FilterableFormat & { itag: number }) =>
          shouldReject(format) || !keepItags.has(format.itag),
      });

      return c.body(manifest, 200, {
        'Content-Type': 'application/dash+xml',
        'Cache-Control': 'no-store',
      });
    } catch (err) {
      lastError = err;
      // Try next client.
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Unknown error';
  return c.json({ error: `Failed to build manifest: ${message}` }, 502);
=======

  try {
    const poToken = await mintPoToken(id);
    const info = await yt.getInfo(id, { client: 'MWEB', po_token: poToken });

    // Serve exactly one video + one audio representation rather than a full
    // quality ladder. dash.js's startup ABR probing fires near-simultaneous
    // requests across every representation, which reads as bot-like traffic
    // to YouTube and was triggering 403s from the CDN — a single
    // representation each means there's nothing to probe between.
    // 'best' rather than a fixed '1080p' label: the MWEB client (needed for
    // full-length playback — see stream.ts) caps out well below 1080p for
    // plenty of videos, and an exact-label request throws outright when
    // that label doesn't exist rather than falling back.
    const videoFormat = info.chooseFormat({ type: 'video', quality: 'best' });
    const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
    const keepItags = new Set([videoFormat.itag, audioFormat.itag]);

    const manifest = await info.toDash({
      url_transformer: (url) => {
        const itag = url.searchParams.get('itag');
        const proxied = new URL(streamPath, origin);
        proxied.searchParams.set('id', id);
        proxied.searchParams.set('mode', 'video');
        if (itag) proxied.searchParams.set('itag', itag);
        return proxied;
      },
      format_filter: (format: FilterableFormat & { itag: number }) =>
        shouldReject(format) || !keepItags.has(format.itag),
    });

    return c.body(manifest, 200, { 'Content-Type': 'application/dash+xml', 'Cache-Control': 'no-store' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: `Failed to build manifest: ${message}` }, 502);
  }
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
});
