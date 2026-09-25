import { Hono } from 'hono';
import { getInnertube } from '../innertube.js';

export const search = new Hono();

interface ResultItem {
  id: string;
  title: string;
  thumbnail: string | null;
  durationText: string | null;
  durationSeconds: number | null;
  author: string | null;
<<<<<<< HEAD
  meta: string | null;
}

type Mode = 'video' | 'music' | 'shorts';

function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    return (v as { toString(): string }).toString();
  }
  return String(v);
}

function extractId(item: Record<string, unknown>): string | null {
  if (typeof item.video_id === 'string' && item.video_id) return item.video_id;
  if (typeof item.id === 'string' && item.id) return item.id;
  const endpoint = item.on_tap_endpoint as
    | { payload?: { videoId?: string } }
    | undefined;
  if (endpoint?.payload?.videoId) return endpoint.payload.videoId;
  const nav = item.endpoint as { payload?: { videoId?: string } } | undefined;
  if (nav?.payload?.videoId) return nav.payload.videoId;
  return null;
}

function extractThumb(item: Record<string, unknown>): string | null {
  const best = item.best_thumbnail as { url?: string } | null | undefined;
  if (best?.url) return best.url;
  const thumbs = item.thumbnails as { url?: string }[] | undefined;
  if (thumbs?.length) return thumbs[thumbs.length - 1]?.url ?? null;
  const thumb = item.thumbnail as
    | { url?: string; contents?: { url?: string }[] }
    | undefined;
  if (thumb?.url) return thumb.url;
  if (thumb?.contents?.length) {
    return thumb.contents[thumb.contents.length - 1]?.url ?? null;
  }
  return null;
}

function pushShort(results: ResultItem[], item: unknown): void {
  const raw = item as Record<string, unknown>;
  const id = extractId(raw);
  if (!id) return;
  // Skip duplicates
  if (results.some((r) => r.id === id)) return;

  const duration = raw.duration as
    | { text?: string; seconds?: number }
    | undefined;
  const authorObj = raw.author as { name?: string } | string | undefined;
  const author =
    typeof authorObj === 'string' ? authorObj : (authorObj?.name ?? null);

  results.push({
    id,
    title: asText(raw.title) || asText(raw.headline) || id,
    thumbnail: extractThumb(raw),
    durationText: duration?.text ?? null,
    durationSeconds: duration?.seconds ?? null,
    author,
    meta:
      asText(raw.short_view_count) ||
      asText(raw.view_count) ||
      asText(raw.views) ||
      null,
  });
}

/**
 * Collect items that are actual YouTube Shorts (reel / short lockup),
 * not merely "short duration" long-form videos.
 */
function collectShortsFromSearch(res: {
  results?: unknown[];
  videos?: unknown[];
}): ResultItem[] {
  const results: ResultItem[] = [];
  const pool = [...(res.results ?? []), ...((res as { videos?: unknown[] }).videos ?? [])];

  for (const item of pool) {
    if (!item || typeof item !== 'object') continue;
    const t = (item as { type?: string }).type ?? '';
    // Official Shorts renderers from Innertube
    if (
      t === 'ReelItem' ||
      t === 'ShortsLockupView' ||
      t === 'ReelWatchEndpoint' ||
      /short|reel/i.test(t)
    ) {
      pushShort(results, item);
      continue;
    }
    // After applyRefinement('Shorts'), results are often still typed Video
    // but are the Shorts vertical catalog — accept Video only when refinement
    // was applied (caller decides); we still accept here if duration ≤ 60s
    // as a soft signal for true Shorts form factor.
    if (t === 'Video' || t === '') {
      const d = (item as { duration?: { seconds?: number } }).duration;
      if (d?.seconds != null && d.seconds > 60) continue;
      pushShort(results, item);
    }
  }
  return results;
=======
  meta: string | null; // view count (video) or album name (music)
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
}

search.get('/', async (c) => {
  const q = c.req.query('q')?.trim();
<<<<<<< HEAD
  const modeParam = c.req.query('mode');
  const mode: Mode =
    modeParam === 'music' ? 'music' : modeParam === 'shorts' ? 'shorts' : 'video';
=======
  const mode = c.req.query('mode') === 'music' ? 'music' : 'video';
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870

  if (!q) {
    return c.json({ error: 'Missing required query param: q' }, 400);
  }

  const yt = await getInnertube();
  const results: ResultItem[] = [];

  if (mode === 'video') {
    const res = await yt.search(q, { type: 'video' });
    for (const item of res.results) {
<<<<<<< HEAD
      if ((item as { type?: string }).type !== 'Video') continue;
      pushShort(results, item); // reuse mapper (ids/titles/thumbs)
    }
  } else if (mode === 'shorts') {
    // Real YouTube Shorts: search, then apply the official "Shorts" chip
    // (same as youtube.com search → filter Shorts). This is NOT the same as
    // duration=short (which includes regular videos under ~4 minutes).
    let res = await yt.search(q, { type: 'all' });
    let applied = false;
    try {
      const chips = res.refinement_filters ?? [];
      const shortsLabel =
        chips.find((f) => typeof f === 'string' && /^shorts$/i.test(f.trim())) ??
        chips.find((f) => typeof f === 'string' && /short/i.test(f));
      if (shortsLabel) {
        res = await res.applyRefinement(shortsLabel);
        applied = true;
      }
    } catch {
      applied = false;
    }

    let shorts = collectShortsFromSearch(res);

    // Fallback: query with #shorts (YouTube treats this as Shorts-intent)
    if (shorts.length === 0) {
      const tagged = await yt.search(`${q} #shorts`, { type: 'video' });
      try {
        const chips = tagged.refinement_filters ?? [];
        const shortsLabel = chips.find(
          (f) => typeof f === 'string' && /short/i.test(f),
        );
        if (shortsLabel) {
          const refined = await tagged.applyRefinement(shortsLabel);
          shorts = collectShortsFromSearch(refined);
        } else {
          shorts = collectShortsFromSearch(tagged);
        }
      } catch {
        shorts = collectShortsFromSearch(tagged);
      }
    }

    // Last resort: duration=short + ≤60s (still prefer vertical Shorts ids)
    if (shorts.length === 0) {
      const shortDur = await yt.search(q, { type: 'video' });
      shorts = collectShortsFromSearch(shortDur).filter(
        (r) => r.durationSeconds == null || r.durationSeconds <= 60,
      );
    }

    results.push(...shorts);
    // mark so client knows we used shorts path
    return c.json({ mode, query: q, results, shortsRefinementApplied: applied });
=======
      if (item.type !== 'Video') continue;
      const video = item as unknown as {
        video_id: string;
        title: { toString(): string };
        best_thumbnail?: { url: string } | null;
        duration: { text?: string; seconds: number };
        author?: { name: string };
        view_count?: { toString(): string };
        short_view_count?: { toString(): string };
      };
      results.push({
        id: video.video_id,
        title: video.title?.toString() ?? '',
        thumbnail: video.best_thumbnail?.url ?? null,
        durationText: video.duration?.text ?? null,
        durationSeconds: video.duration?.seconds ?? null,
        author: video.author?.name ?? null,
        meta: video.short_view_count?.toString() ?? video.view_count?.toString() ?? null,
      });
    }
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
  } else {
    const res = await yt.music.search(q, { type: 'song' });
    const shelfItems = res.songs?.contents ?? [];
    for (const item of shelfItems) {
      const track = item as unknown as {
        id?: string;
        title?: string;
        thumbnail?: { contents?: { url: string }[] } | null;
        duration?: { text: string; seconds: number };
        artists?: { name: string }[];
        album?: { name: string };
      };
      if (!track.id || !track.title) continue;
      const thumbs = track.thumbnail?.contents ?? [];
      results.push({
        id: track.id,
        title: track.title,
        thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : null,
        durationText: track.duration?.text ?? null,
        durationSeconds: track.duration?.seconds ?? null,
        author: track.artists?.map((a) => a.name).join(', ') ?? null,
        meta: track.album?.name ?? null,
      });
    }
  }

  return c.json({ mode, query: q, results });
});
