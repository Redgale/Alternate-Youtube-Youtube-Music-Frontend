const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';
// This worker shares one domain with other future workers, each under its
// own path prefix — everything it exposes lives under /ytdash.
const PATH_PREFIX = '/ytdash';

export type Mode = 'video' | 'music';

export interface ResultItem {
  id: string;
  title: string;
  thumbnail: string | null;
  durationText: string | null;
  durationSeconds: number | null;
  author: string | null;
  meta: string | null;
}

export interface SearchResponse {
  mode: Mode;
  query: string;
  results: ResultItem[];
}

export interface FormatInfo {
  itag: number;
  mimeType: string;
  qualityLabel: string | null;
  hasAudio: boolean;
  hasVideo: boolean;
  bitrate: number;
  contentLength: number | null;
}

export interface InfoResponse {
  mode: Mode;
  id: string;
  title: string;
  author: string | null;
  durationSeconds: number | null;
  thumbnail: string | null;
  viewCount: number | null;
  shortDescription: string | null;
  formats: FormatInfo[];
}

async function request<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function search(query: string, mode: Mode): Promise<SearchResponse> {
  return request(`${PATH_PREFIX}/api/search`, { q: query, mode });
}

export function getInfo(id: string, mode: Mode): Promise<InfoResponse> {
  return request(`${PATH_PREFIX}/api/info`, { id, mode });
}

export function streamUrl(
  id: string,
  mode: Mode,
  opts: { download?: boolean; kind?: 'video' | 'audio' } = {},
): string {
  const url = new URL(`${PATH_PREFIX}/api/stream`, API_BASE_URL);
  url.searchParams.set('id', id);
  url.searchParams.set('mode', mode);
  if (opts.download) url.searchParams.set('download', '1');
  if (opts.kind) url.searchParams.set('kind', opts.kind);
  return url.toString();
}

export function dashManifestUrl(id: string): string {
  const url = new URL(`${PATH_PREFIX}/api/dash`, API_BASE_URL);
  url.searchParams.set('id', id);
  // Cache-bust: the manifest embeds a freshly-resolved itag pairing each
  // time, and any intermediate cache (CDN, browser) serving a stale copy
  // would silently point at a representation the worker no longer expects.
  url.searchParams.set('_', Date.now().toString(36));
  return url.toString();
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
