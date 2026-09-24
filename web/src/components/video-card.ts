import type { ResultItem } from '../api.js';
import { navigate } from '../router.js';

export function renderVideoCard(item: ResultItem): HTMLElement {
  const card = document.createElement('article');
  card.className = 'video-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'video-card__thumb';
  if (item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.loading = 'lazy';
    img.alt = '';
    thumbWrap.appendChild(img);
  }
  if (item.durationText) {
    const dur = document.createElement('span');
    dur.className = 'video-card__duration';
    dur.textContent = item.durationText;
    thumbWrap.appendChild(dur);
  }

  const meta = document.createElement('div');
  meta.className = 'video-card__meta';

  const title = document.createElement('h3');
  title.className = 'video-card__title';
  title.textContent = item.title;

  const sub = document.createElement('p');
  sub.className = 'video-card__sub';
  sub.textContent = [item.author, item.meta].filter(Boolean).join(' · ');

  meta.append(title, sub);
  card.append(thumbWrap, meta);

  const go = () => navigate('/watch', { v: item.id });
  card.addEventListener('click', go);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  });

  return card;
}
