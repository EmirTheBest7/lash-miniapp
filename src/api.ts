import { initDataRaw } from './tg';

/**
 * EVERY call is a CORS "simple request": POST, body = JSON sent as text/plain, NO custom headers, NO query string.
 * (A preflight would cost one of the few PHP workers shared with the website, and OPTIONS through the host is unverified.)
 * initData, op_id and the client version therefore travel in the BODY. Do not add a `headers` option or `cache`/`keepalive` here:
 * tests/api.test.ts and the e2e network check fail on any non-simple request.
 */
export const CLIENT_VERSION = 1;
export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

export interface ApiErrorBody { code: string; message?: string; cid?: string }
export type ApiResult<T> = { ok: true; data: T; cid?: string; replayed?: boolean } | { ok: false; status: number; error: ApiErrorBody };

type MockHandler = (route: string, data: unknown) => Promise<ApiResult<unknown>> | ApiResult<unknown>;
declare global { interface Window { __MOCK_API__?: MockHandler } }

export const newOpId = (): string => (crypto.randomUUID?.() ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replaceAll('-', '').slice(0, 32).padEnd(16, '0');

export async function api<T>(route: string, data?: Record<string, unknown>, opId?: string): Promise<ApiResult<T>> {
  if (window.__MOCK_API__) return (await window.__MOCK_API__(route, data ?? {})) as ApiResult<T>;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}/${route}`, {
      method: 'POST',
      body: JSON.stringify({ init_data: initDataRaw(), client_version: CLIENT_VERSION, ...(opId ? { op_id: opId } : {}), ...(data ? { data } : {}) }),
      credentials: 'omit',
      signal: ctl.signal,
    });
    let json: unknown;
    try { json = await res.json(); } catch { return { ok: false, status: res.status, error: { code: 'network' } }; }   // an HTML error page etc.
    const j = json as { ok?: boolean; data?: T; cid?: string; replayed?: boolean; error?: ApiErrorBody };
    if (j && j.ok === true) return { ok: true, data: j.data as T, cid: j.cid, replayed: j.replayed };
    return { ok: false, status: res.status, error: j?.error ?? { code: 'internal' } };
  } catch {
    return { ok: false, status: 0, error: { code: 'network' } };
  } finally {
    clearTimeout(timer);
  }
}
