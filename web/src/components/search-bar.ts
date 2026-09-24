export function renderSearchBar(placeholder: string, initial: string, onSearch: (q: string) => void): HTMLElement {
  const form = document.createElement('form');
  form.className = 'search-bar';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = placeholder;
  input.value = initial;
  input.className = 'search-bar__input';
  input.setAttribute('aria-label', placeholder);

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'search-bar__button';
  button.textContent = 'Search';

  form.append(input, button);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) onSearch(q);
  });

  return form;
}
