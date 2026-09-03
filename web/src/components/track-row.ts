import type { ResultItem } from '../api.js';
import { formatDuration } from '../api.js';
import { playQueue } from '../state.js';

export function renderTrackRow(item: ResultItem, index: number, queue: ResultItem[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'track-row';
  row.tabIndex = 0;
  row.setAttribute('role', 'button');

  const thumb = document.createElement('div');
  thumb.className = 'track-row__thumb';
  if (item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.loading = 'lazy';
    img.alt = '';
    thumb.appendChild(img);
  }

  const meta = document.createElement('div');
  meta.className = 'track-row__meta';
  const title = document.createElement('div');
  title.className = 'track-row__title';
  title.textContent = item.title;
  const sub = document.createElement('div');
  sub.className = 'track-row__sub';
  sub.textContent = [item.author, item.meta].filter(Boolean).join(' · ');
  meta.append(title, sub);

  const duration = document.createElement('div');
  duration.className = 'track-row__duration';
  duration.textContent = item.durationText ?? formatDuration(item.durationSeconds);

  row.append(thumb, meta, duration);

  const play = () => playQueue(queue, index);
  row.addEventListener('click', play);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      play();
    }
  });

  return row;
}
