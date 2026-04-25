export interface Bootstrap {
  port: number;
  version: string;
  token: string;
}

const TOKEN_KEY = 'llmscope.token';

export function readSavedToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export async function bootstrap(): Promise<Bootstrap> {
  const url = new URL(window.location.href);
  const queryToken = url.searchParams.get('t');
  if (queryToken) {
    saveToken(queryToken);
    url.searchParams.delete('t');
    history.replaceState(null, '', url.toString());
  }
  const res = await fetch('/api/_bootstrap');
  if (!res.ok) throw new Error(`bootstrap ${res.status}`);
  const j = (await res.json()) as Bootstrap;
  if (j.token) saveToken(j.token);
  return j;
}

export function authHeader(): Record<string, string> {
  const t = readSavedToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeader() },
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${res.status}`);
  return (await res.json()) as T;
}
