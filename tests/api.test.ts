import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, newOpId } from '../src/api';

describe('api client: every call is a CORS simple request (no preflight)', () => {
  let calls: { url: string; init: RequestInit }[];
  beforeEach(() => {
    calls = [];
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { Telegram: { WebApp: { initData: 'auth_date=1&hash=x' } } }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data: { hi: 1 }, cid: 'abcd1234' }), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs a string body with NO headers option, NO query string, credentials omitted', async () => {
    await api('bootstrap', { a: 1 }, newOpId());
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(init.method).toBe('POST');
    expect('headers' in init).toBe(false);                 // a string body then defaults to text/plain;charset=UTF-8 (safelisted)
    expect(typeof init.body).toBe('string');
    expect(init.credentials).toBe('omit');
    for (const forbidden of ['cache', 'keepalive', 'mode'] as const) expect(forbidden in init).toBe(false);
    expect(url).not.toContain('?');
    expect(url.endsWith('/bootstrap')).toBe(true);
  });

  it('carries initData, op_id and the client version in the BODY', async () => {
    const op = newOpId();
    await api('x', { n: 2 }, op);
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body).toMatchObject({ init_data: 'auth_date=1&hash=x', client_version: 1, op_id: op, data: { n: 2 } });
    expect(op).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('omits op_id and data when not given', async () => {
    await api('bootstrap');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect('op_id' in body).toBe(false);
    expect('data' in body).toBe(false);
  });

  it('maps a success body, API errors, HTML error pages and network failures to a typed result', async () => {
    const ok = await api<{ hi: number }>('bootstrap');
    expect(ok).toMatchObject({ ok: true, data: { hi: 1 }, cid: 'abcd1234' });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: 'forbidden', cid: 'c1' } }), { status: 403 })));
    expect(await api('x')).toMatchObject({ ok: false, status: 403, error: { code: 'forbidden', cid: 'c1' } });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Pixelite 404</html>', { status: 404 })));
    expect(await api('x')).toMatchObject({ ok: false, error: { code: 'network' } });          // not JSON = treated as unreachable

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await api('x')).toMatchObject({ ok: false, status: 0, error: { code: 'network' } });
  });

  it('uses the mock handler when installed (dev/e2e only) and never touches the network', async () => {
    (window as unknown as { __MOCK_API__: unknown }).__MOCK_API__ = async () => ({ ok: true, data: { mocked: true } });
    expect(await api('anything')).toMatchObject({ ok: true, data: { mocked: true } });
    expect(calls).toHaveLength(0);
    delete (window as unknown as { __MOCK_API__?: unknown }).__MOCK_API__;
  });

  it('generates unique op ids', () => {
    expect(new Set(Array.from({ length: 200 }, newOpId)).size).toBe(200);
  });
});
