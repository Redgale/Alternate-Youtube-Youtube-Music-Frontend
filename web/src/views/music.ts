import { search, type ResultItem } from '../api.js';
import { renderSearchBar } from '../components/search-bar.js';
import { renderTrackRow } from '../components/track-row.js';
import { navigate } from '../router.js';

export function renderMusic(container: HTMLElement, query: string): void {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view view--music';

  const header = document.createElement('div');
  header.className = 'view__header';
  const heading = document.createElement('h1');
  heading.className = 'view__heading view__heading--music';
  heading.textContent = 'Music';
  header.appendChild(heading);
  header.appendChild(
    renderSearchBar('Search songs', query, (q) => {
      navigate('/music', { q });
      renderMusic(container, q);
    }),
  );

  const list = document.createElement('div');
  list.className = 'track-list';

  wrap.append(header, list);
  container.appendChild(wrap);

  if (!query) {
    list.innerHTML = '<p class="view__empty">Search for a song or artist.</p>';
    return;
  }

  list.innerHTML = '<p class="view__loading">Searching…</p>';
  search(query, 'music')
    .then((res) => {
      list.innerHTML = '';
      if (res.results.length === 0) {
        list.innerHTML = '<p class="view__empty">No results.</p>';
        return;
      }
      renderTrackList(list, res.results);
    })
    .catch((err: Error) => {
      list.innerHTML = `<p class="view__error">${err.message}</p>`;
    });
}

function renderTrackList(list: HTMLElement, results: ResultItem[]): void {
  results.forEach((item, i) => {
    list.appendChild(renderTrackRow(item, i, results));
  });
}
