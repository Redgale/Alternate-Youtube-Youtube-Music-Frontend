import type * as Dashjs from 'dashjs';
import { getInfo, streamUrl, dashManifestUrl } from '../api.js';

let activePlayer: Dashjs.MediaPlayerClass | null = null;

export function renderWatch(container: HTMLElement, videoId: string): void {
  activePlayer?.destroy();
  activePlayer = null;

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view view--watch';

  const playerHost = document.createElement('div');
  playerHost.className = 'watch-player';

  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;
  playerHost.appendChild(video);

  const playerError = document.createElement('p');
  playerError.className = 'watch-player__error';
  playerError.hidden = true;
  playerHost.appendChild(playerError);

  const info = document.createElement('div');
  info.className = 'watch-info';
  info.innerHTML = '<p class="view__loading">Loading…</p>';

  wrap.append(playerHost, info);
  container.appendChild(wrap);

  // Video plays via our own worker (a DASH manifest whose segment URLs
  // point back at /api/stream) instead of the YouTube iframe embed. Some
  // videos have embedding disabled by the uploader, which blocks the
  // iframe player outright but has no bearing on fetching the stream
  // directly — the same reason music moved off the iframe too. dashjs is
  // ~250KB gzipped, so it's loaded lazily — search/music pages never pay
<<<<<<< HEAD
  // for it. Long VODs and (most) livestreams are supported via the worker's
  // client-fallback + official live-MPD rewrite path.
=======
<<<<<<< HEAD
  // for it. Long VODs and (most) livestreams are supported via the worker's
  // client-fallback + official live-MPD rewrite path.
=======
  // for it.
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
  import('dashjs').then((dashjs) => {
    if (video.isConnected === false) return; // navigated away before this loaded
    const player = dashjs.MediaPlayer().create();
    activePlayer = player;
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
    player.on(dashjs.MediaPlayer.events.ERROR, (e: unknown) => {
      const detail =
        e && typeof e === 'object' && 'error' in e
          ? String((e as { error?: { message?: string } }).error?.message ?? '')
          : '';
      playerError.textContent = detail
        ? `Playback error: ${detail}`
        : "This video can't be played (removed, private, live-HLS-only, or unavailable).";
<<<<<<< HEAD
=======
=======
    player.on(dashjs.MediaPlayer.events.ERROR, () => {
      playerError.textContent = "This video can't be played (removed, private, or unavailable).";
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
      playerError.hidden = false;
    });
    player.initialize(video, dashManifestUrl(videoId), true);
  });

  getInfo(videoId, 'video')
    .then((data) => {
      info.innerHTML = '';

      const title = document.createElement('h1');
      title.className = 'watch-info__title';
      title.textContent = data.title;

      const sub = document.createElement('p');
      sub.className = 'watch-info__sub';
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
      const parts = [
        data.isLive ? 'LIVE' : null,
        data.author,
        data.viewCount ? `${data.viewCount.toLocaleString()} views` : null,
        !data.isLive && data.durationSeconds
          ? new Date(data.durationSeconds * 1000).toISOString().substr(11, 8).replace(/^00:/, '')
          : null,
      ].filter(Boolean);
<<<<<<< HEAD
=======
=======
      const parts = [data.author, data.viewCount ? `${data.viewCount.toLocaleString()} views` : null].filter(
        Boolean,
      );
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
      sub.textContent = parts.join(' · ');

      const actions = document.createElement('div');
      actions.className = 'watch-info__actions';

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870
      if (!data.isLive) {
        const videoBtn = document.createElement('a');
        videoBtn.className = 'button button--primary';
        videoBtn.textContent = 'Download video';
        videoBtn.href = streamUrl(videoId, 'video', { download: true, kind: 'video' });

        const audioBtn = document.createElement('a');
        audioBtn.className = 'button button--secondary';
        audioBtn.textContent = 'Download audio';
        audioBtn.href = streamUrl(videoId, 'video', { download: true, kind: 'audio' });

        actions.append(videoBtn, audioBtn);
      } else {
        const liveNote = document.createElement('p');
        liveNote.className = 'watch-info__live-note';
        liveNote.textContent =
          'Livestream — downloads are disabled while the stream is ongoing.';
        actions.append(liveNote);
      }
<<<<<<< HEAD
=======
=======
      const videoBtn = document.createElement('a');
      videoBtn.className = 'button button--primary';
      videoBtn.textContent = 'Download video';
      videoBtn.href = streamUrl(videoId, 'video', { download: true, kind: 'video' });

      const audioBtn = document.createElement('a');
      audioBtn.className = 'button button--secondary';
      audioBtn.textContent = 'Download audio';
      audioBtn.href = streamUrl(videoId, 'video', { download: true, kind: 'audio' });

      actions.append(videoBtn, audioBtn);
>>>>>>> 37ae4b418d092e5a05f958e4f5cc6af624948be1
>>>>>>> 3a6c7022f3ade0cad61e1ba2bd8746b85184e870

      const desc = document.createElement('p');
      desc.className = 'watch-info__desc';
      desc.textContent = data.shortDescription ?? '';

      info.append(title, sub, actions, desc);
    })
    .catch((err: Error) => {
      info.innerHTML = `<p class="view__error">${err.message}</p>`;
    });
}
