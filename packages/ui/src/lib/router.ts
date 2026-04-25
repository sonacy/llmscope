import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.slice(1) || '/';
  const [path, q = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const h = () => setRoute(parseHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

export function navigate(path: string, query?: Record<string, string | undefined>): void {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v != null && v !== '') q.set(k, v);
  }
  const qs = q.toString();
  window.location.hash = qs ? `${path}?${qs}` : path;
}

export function setQuery(updater: (q: URLSearchParams) => void): void {
  const r = parseHash();
  updater(r.query);
  const qs = r.query.toString();
  window.location.hash = qs ? `${r.path}?${qs}` : r.path;
}
