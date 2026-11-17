import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

export const TOKEN = process.env.BOT_TOKEN ?? '';
export const BASE = process.env.LIVE_URL ?? '';

/** Synthetic initData signed exactly like Telegram does (key "WebAppData", message = bot token). */
export function signedInitData(user: Record<string, unknown>): string {
  const fields: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAHSYNTHETIC', user: JSON.stringify(user) };
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return Object.entries(fields).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') + `&hash=${hash}`;
}

export async function asUser(page: Page, id: number, first: string) {
  const user = { id, first_name: first, last_name: 'Tester', language_code: 'en' };
  await page.route('https://telegram.org/**', (r) => r.abort());
  await page.addInitScript(([initData, u]) => {
    const noop = () => {};
    (window as any).Telegram = { WebApp: {
      initData, initDataUnsafe: { user: u }, version: '8.0', platform: 'ios', colorScheme: 'light', themeParams: {}, isExpanded: true, viewportStableHeight: 800,
      ready: noop, expand: noop, close: noop, isVersionAtLeast: () => true, setHeaderColor: noop, setBackgroundColor: noop, onEvent: noop, offEvent: noop,
      BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop }, HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
      showConfirm: (_m: string, cb: (ok: boolean) => void) => cb(true), requestContact: (cb?: (s: boolean) => void) => cb?.(true),
    } };
  }, [signedInitData(user), user] as const);
  await page.goto(BASE);
}

