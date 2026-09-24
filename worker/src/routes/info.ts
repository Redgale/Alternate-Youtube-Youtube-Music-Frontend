import { Hono } from 'hono';
import { getInnertube } from '../innertube.js';

export const info = new Hono();

info.get('/', async (c) => {
  const id = c.req.query('id')?.trim();
  const mode = c.req.query('mode') === 'music' ? 'music' : 'video';

  if (!id) {
    return c.json({ error: 'Missing required query param: id' }, 400);
  }

  const yt = await getInnertube();

  try {
    const details =
      mode === 'music' ? await yt.music.getInfo(id) : await yt.getInfo(id, { client: 'MWEB' });
    const basic = details.basic_info;

    const formats = (details.streaming_data?.adaptive_formats ?? [])
      .filter((f) => f.has_audio || f.has_video)
      .map((f) => ({
        itag: f.itag,
        mimeType: f.mime_type,
        qualityLabel: f.quality_label ?? f.audio_quality ?? null,
        hasAudio: f.has_audio,
        hasVideo: f.has_video,
        bitrate: f.bitrate,
        contentLength: f.content_length ?? null,
      }));

    const isLive = !!(basic.is_live || basic.is_live_content);
    // Official live manifests (only present for live / post-live DVR).
    const hlsManifestUrl = details.streaming_data?.hls_manifest_url ?? null;
    const dashManifestUrl = details.streaming_data?.dash_manifest_url ?? null;

    return c.json({
      mode,
      id: basic.id ?? id,
      title: basic.title ?? '',
      author: basic.author ?? basic.channel?.name ?? null,
      durationSeconds: basic.duration ?? null,
      thumbnail: basic.thumbnail?.at(-1)?.url ?? null,
      viewCount: basic.view_count ?? null,
      shortDescription: basic.short_description ?? null,
      formats,
      isLive,
      hlsManifestUrl,
      dashManifestUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: `Failed to fetch info: ${message}` }, 502);
  }
});
