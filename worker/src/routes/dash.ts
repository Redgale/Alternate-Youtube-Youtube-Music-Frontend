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
 */
dash.get('/', async (c) => {
  const id = c.req.query('id')?.trim();
  if (!id) return c.json({ error: 'Missing required query param: id' }, 400);

  const proto = c.req.header('x-forwarded-proto') ?? 'http';
  const host = c.req.header('host') ?? 'localhost';
  const origin = `${proto}://${host}`;
  const streamPath = c.req.path.replace(/\/api\/dash$/, '/api/stream');

  const yt = await getInnertube();

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
});
