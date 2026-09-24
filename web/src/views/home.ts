import { search } from '../api.js';
import { renderSearchBar } from '../components/search-bar.js';
import { renderVideoCard } from '../components/video-card.js';
import { navigate } from '../router.js';

export function renderHome(container: HTMLElement, query: string): void {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view view--home';

  const header = document.createElement('div');
  header.className = 'view__header';
  const heading = document.createElement('h1');
  heading.className = 'view__heading';
  heading.textContent = 'Videos';
  header.appendChild(heading);
  header.appendChild(
    renderSearchBar('Search videos', query, (q) => {
      navigate('/', { q });
      renderHome(container, q);
    }),
  );

  const grid = document.createElement('div');
  grid.className = 'video-grid';

  wrap.append(header, grid);
  container.appendChild(wrap);

  if (!query) {
    grid.innerHTML = '<p class="view__empty">Search for something to watch.</p>';
    return;
  }

  grid.innerHTML = '<p class="view__loading">Searching…</p>';
  search(query, 'video')
    .then((res) => {
      grid.innerHTML = '';
      if (res.results.length === 0) {
        grid.innerHTML = '<p class="view__empty">No results.</p>';
        return;
      }
      for (const item of res.results) {
        grid.appendChild(renderVideoCard(item));
      }
    })
    .catch((err: Error) => {
      grid.innerHTML = `<p class="view__error">${err.message}</p>`;
    });
}
