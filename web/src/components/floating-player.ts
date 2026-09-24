import { streamUrl, formatDuration } from '../api.js';
import { subscribe, getCurrentTrack, setPlaying, playNext, playPrevious, type PlayerState } from '../state.js';

// Music plays through a plain <audio> element pointed at our own worker's
// stream endpoint rather than the YouTube iframe embed. Some tracks have
// embedding disabled by the rights holder, which silently blocks the
// iframe player entirely — our worker fetches the audio directly via
// Innertube (the same path the download button uses), which isn't subject
// to that restriction, so this plays everything the worker can resolve.

const POSITION_KEY = 'floatingPlayerPos';

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePosition(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export function mountFloatingPlayer(root: HTMLElement): void {
  const card = document.createElement('div');
  card.className = 'floating-player';
  card.hidden = true;

  const audio = new Audio();
  audio.preload = 'auto';

  const dragHandle = document.createElement('div');
  dragHandle.className = 'floating-player__handle';

  const thumb = document.createElement('img');
  thumb.className = 'floating-player__thumb';
  thumb.alt = '';

  const meta = document.createElement('div');
  meta.className = 'floating-player__meta';
  const title = document.createElement('div');
  title.className = 'floating-player__title';
  const sub = document.createElement('div');
  sub.className = 'floating-player__sub';
  meta.append(title, sub);

  const downloadBtn = document.createElement('a');
  downloadBtn.className = 'floating-player__download';
  downloadBtn.textContent = '⬇';
  downloadBtn.title = 'Download';

  dragHandle.append(thumb, meta, downloadBtn);

  const controls = document.createElement('div');
  controls.className = 'floating-player__controls';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'floating-player__btn';
  prevBtn.textContent = '⏮';
  prevBtn.setAttribute('aria-label', 'Previous');

  const playBtn = document.createElement('button');
  playBtn.className = 'floating-player__btn floating-player__btn--play';
  playBtn.textContent = '⏸';
  playBtn.setAttribute('aria-label', 'Play/Pause');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'floating-player__btn';
  nextBtn.textContent = '⏭';
  nextBtn.setAttribute('aria-label', 'Next');

  controls.append(prevBtn, playBtn, nextBtn);

  const status = document.createElement('div');
  status.className = 'floating-player__status';
  status.hidden = true;

  card.append(dragHandle, controls, status);
  root.appendChild(card);

  // --- dragging ---
  const pos = loadPosition();
  if (pos) {
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  }

  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  dragHandle.addEventListener('pointerdown', (e) => {
    dragging = true;
    const rect = card.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    dragHandle.setPointerCapture(e.pointerId);
    card.classList.add('is-dragging');
  });

  dragHandle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const x = Math.min(Math.max(0, e.clientX - dragOffsetX), window.innerWidth - card.offsetWidth);
    const y = Math.min(Math.max(0, e.clientY - dragOffsetY), window.innerHeight - card.offsetHeight);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  });

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('is-dragging');
    const rect = card.getBoundingClientRect();
    savePosition({ x: rect.left, y: rect.top });
    dragHandle.releasePointerCapture(e.pointerId);
  };
  dragHandle.addEventListener('pointerup', endDrag);
  dragHandle.addEventListener('pointercancel', endDrag);

  // --- playback ---
  let loadedId: string | null = null;

  const showStatus = (msg: string) => {
    status.textContent = msg;
    status.hidden = false;
    window.setTimeout(() => {
      status.hidden = true;
    }, 2500);
  };

  audio.addEventListener('ended', () => {
    if (!playNext()) setPlaying(false);
  });
  audio.addEventListener('error', () => {
    showStatus('Skipped — unplayable track');
    if (!playNext()) setPlaying(false);
  });
  audio.addEventListener('playing', () => {
    playBtn.textContent = '⏸';
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
  });

  prevBtn.addEventListener('click', () => playPrevious());
  nextBtn.addEventListener('click', () => playNext());
  playBtn.addEventListener('click', () => {
    const track = getCurrentTrack();
    if (!track) return;
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  });

  subscribe((state: PlayerState) => {
    const track = getCurrentTrack();
    if (!track) {
      card.hidden = true;
      audio.pause();
      return;
    }
    card.hidden = false;

    if (track.thumbnail) thumb.src = track.thumbnail;
    title.textContent = track.title;
    sub.textContent = [track.author, track.durationText ?? formatDuration(track.durationSeconds)]
      .filter(Boolean)
      .join(' · ');
    downloadBtn.href = streamUrl(track.id, 'music', { download: true });

    if (loadedId !== track.id) {
      loadedId = track.id;
      audio.src = streamUrl(track.id, 'music', { kind: 'audio' });
      audio.play();
      playBtn.textContent = '⏸';
    } else if (state.playing) {
      audio.play();
    } else {
      audio.pause();
    }
  });
}
