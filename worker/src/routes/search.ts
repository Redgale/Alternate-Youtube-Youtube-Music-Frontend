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
  meta: string | null; // view count (video) or album name (music)
}

search.get('/', async (c) => {
  const q = c.req.query('q')?.trim();
  const mode = c.req.query('mode') === 'music' ? 'music' : 'video';

  if (!q) {
    return c.json({ error: 'Missing required query param: q' }, 400);
  }

  const yt = await getInnertube();
  const results: ResultItem[] = [];

  if (mode === 'video') {
    const res = await yt.search(q, { type: 'video' });
    for (const item of res.results) {
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
