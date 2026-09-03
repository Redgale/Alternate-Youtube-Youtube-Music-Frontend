export interface Route {
  path: string; // e.g. "/watch"
  query: URLSearchParams;
}

type Listener = (route: Route) => void;

const listeners = new Set<Listener>();

function parseHash(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, queryStr] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(queryStr ?? '') };
}

window.addEventListener('hashchange', () => {
  const route = parseHash();
  for (const l of listeners) l(route);
});

export function onRouteChange(listener: Listener): () => void {
  listeners.add(listener);
  listener(parseHash());
  return () => listeners.delete(listener);
}

export function navigate(path: string, query?: Record<string, string>): void {
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  location.hash = `${path}${qs}`;
}

export function currentRoute(): Route {
  return parseHash();
}
