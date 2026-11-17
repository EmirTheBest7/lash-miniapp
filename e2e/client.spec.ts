import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const open = async (page: Page, q = '') => { await blockTelegramScript(page); await page.goto(`${BASE}?mock=1${q}`); };
const shot = async (page: Page, name: string) => { mkdirSync('e2e-artifacts', { recursive: true }); await page.screenshot({ path: `e2e-artifacts/${name}.png`, fullPage: true }); };
const noSidewaysScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
const width = (s: string) => [...s.replaceAll('\uFE0F', '')].length + (s.match(/\p{Extended_Pictographic}/gu) ?? []).length;

async function toSummary(page: Page, service = 'Lash fill', time = '10:30') {
  await page.getByRole('button', { name: new RegExp(service) }).click();
  await expect(page.getByTestId('strip')).toBeVisible();
  await page.getByRole('button', { name: time, exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
}

test('home lists services with duration and price (details in the cell, not on a button) and links', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Lash Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Lash fill.*1 h 15 min.*1\s000\sKč/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Lash lift.*price on request/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /My appointments/ })).toBeVisible();
  await noSidewaysScroll(page);
});

test('book in 4 taps after the service: service -> time -> Continue -> Confirm, then it shows in My appointments', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await page.getByRole('button', { name: '10:30', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Monday', { exact: false }).or(page.getByText('Tuesday'))).toBeVisible();
  await expect(page.getByText('The master confirms new bookings first')).toBeVisible();
  await expect(page.getByText('A fill needs existing extensions')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('done-title')).toHaveText('Waiting for confirmation');
  await shot(page, 'client-done');
  await page.getByRole('button', { name: /My appointments/ }).click();
  await expect(page.getByRole('button', { name: /Lash fill/ })).toBeVisible();
});

test('the day strip marks closed days (disabled), booked-out days (struck through) and names today/tomorrow', async ({ page }) => {
  await open(page, '&full=1');
  await page.getByRole('button', { name: /Lash fill/ }).click();
  const strip = page.getByTestId('strip');
  await expect(strip.getByRole('button', { name: /Today/ })).toBeDisabled();            // inside the notice window
  await expect(strip.getByRole('button', { name: /Tomorrow/ })).toBeEnabled();
  expect(await strip.locator('.chip.struck').count()).toBe(1);
  expect(await strip.locator('.chip:disabled').count()).toBeGreaterThanOrEqual(2);       // today + a Sunday
  await strip.locator('.chip.struck').click();
  await expect(page.getByRole('dialog')).toContainText('Fully booked');
  await page.getByRole('button', { name: 'Notify me' }).click();
  await expect(page.getByRole('status')).toContainText('We will message you');
});

test('add-ons live in a sheet (zero extra taps by default) and change the duration', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await expect(page.getByText('1 h 15 min', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Add-ons/ }).click();
  await page.getByRole('switch', { name: 'Lash tint' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Add-ons (1)' })).toBeVisible();
  await expect(page.getByText('1 h 30 min', { exact: false }).first()).toBeVisible();
});

test('first-time gate: privacy, then the phone is shared with one tap, then the booking goes through by itself', async ({ page }) => {
  await open(page, '&new=1');
  await toSummary(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog').first()).toContainText('Privacy notice');
  await shot(page, 'client-gate-privacy');
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await expect(page.getByRole('dialog')).toContainText('Your phone number');
  await page.getByRole('button', { name: 'Share my phone' }).click();
  await expect(page.getByTestId('done-title')).toBeVisible({ timeout: 8000 });
});

test('a slot taken before Confirm offers the closest alternatives and books the chosen one', async ({ page }) => {
  await open(page, '&taken=1');
  await toSummary(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('This time was just taken');
  const alts = page.getByRole('dialog').getByRole('button', { name: /\d\d:\d\d/ });
  expect(await alts.count()).toBe(3);
  await alts.first().click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('done-title')).toBeVisible();
});

test('cancel (native confirm) and reschedule (same picker, one atomic move)', async ({ page }) => {
  await open(page);
  await toSummary(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: /My appointments/ }).click();
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await page.getByRole('button', { name: 'Reschedule' }).click();
  await page.getByRole('button', { name: '12:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Current time')).toBeVisible();
  await expect(page.getByText('New time')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm the change' }).click();
  await expect(page.getByTestId('done-title')).toHaveText('Appointment moved');
  await page.getByRole('button', { name: /My appointments/ }).click();
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await page.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(page.getByRole('status')).toContainText('Appointment cancelled');
  await expect(page.getByText('No upcoming appointments')).toBeVisible();
});

test('"Book again" appears for returning clients and starts on the suggested day', async ({ page }) => {
  await open(page, '&again=1');
  await expect(page.getByRole('button', { name: /Book again: Lash fill/ })).toBeVisible();
  await page.getByRole('button', { name: /Book again: Lash fill/ }).click();
  await expect(page.getByTestId('strip').locator('.chip[aria-pressed="true"]')).toContainText('Wed 18');
});

test('language switch re-renders the whole app', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Language/ }).click();
  await page.getByRole('tab', { name: 'CS' }).click();
  await expect(page.getByRole('button', { name: /Moje rezervace/ })).toBeVisible();
});

for (const lang of ['cs', 'en', 'ru', 'uk'] as const) {
  for (const [theme, platform] of [['light', 'ios'], ['dark', 'android']] as const) {
    test(`every screen fits and every chip label fits its width budget: ${lang} / ${theme} / ${platform}`, async ({ page }) => {
      await open(page, `&lang=${lang}&theme=${theme}&platform=${platform}&again=1&full=1`);
      await noSidewaysScroll(page);
      await shot(page, `client-home-${lang}-${theme}-${platform}`);
      await page.locator('button.cell').nth(1).click();
      await expect(page.getByTestId('strip')).toBeVisible();
      for (const chip of await page.getByTestId('strip').locator('.chip').all()) {
        const label = (await chip.evaluate((e) => (e.firstChild as Text).textContent ?? '')).trim();
        expect(width(label), `${lang} strip chip "${label}"`).toBeLessThanOrEqual(11);          // 3-per-row budget
      }
      for (const chip of await page.getByTestId('slots-morning').locator('.chip').all()) expect(width((await chip.textContent())!.trim())).toBeLessThanOrEqual(7);
      await noSidewaysScroll(page);
      await shot(page, `client-pick-${lang}-${theme}-${platform}`);
      await page.getByRole('button', { name: /\d\d:\d\d/ }).first().click();
      await page.getByRole('button', { name: /^(Continue|Pokračovat|Продолжить|Продовжити)$/ }).click();
      await noSidewaysScroll(page);
      await shot(page, `client-summary-${lang}-${theme}-${platform}`);
    });
  }
}

test('an outage shows a friendly retry', async ({ page }) => {
  await blockTelegramScript(page);
  await page.route('https://api.example.test/**', (r) => r.abort());
  await page.goto('http://localhost:4174/lash-miniapp/');
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('every API request is a CORS simple request: POST, text/plain, no custom headers, NO preflight (cross-origin API)', async ({ page }) => {
  await blockTelegramScript(page);
  const seen: { method: string; headers: Record<string, string>; url: string; body: string | null }[] = [];
  const fx = { me: { id: 1, name: 'Anna', username: null, role: 'client', lang: 'en', phone_set: true, privacy_accepted: true }, config: { tz: 'Europe/Prague', studio_name: '', currency: 'CZK', min_client_version: 1, contact_username: null, server_time: 1790000000 }, start_param: null, categories: [{ id: 1, name: 'Lashes', services: [{ id: 2, name: 'Lash fill', description: '', duration_min: 75, price: 1000, price_from: false }] }], addons: [], my: [], again: null, policy: { cancel_cutoff_h: 24, horizon_days: 60 }, privacy: { title: 'p', text: 't' } };
  await page.route('https://api.example.test/**', async (route) => {
    const r = route.request();
    seen.push({ method: r.method(), headers: r.headers(), url: r.url(), body: r.postData() });
    const isAvail = r.url().endsWith('/availability');
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://localhost:4174' },
      body: JSON.stringify({ ok: true, data: isAvail ? { strip: [{ date: '2026-11-18', status: 'free', free: 5 }], first: { date: '2026-11-18', slots: [{ start: 1, date: '2026-11-18', time: '10:00' }] }, quote: { duration_min: 75, price: 1000, price_from: false, warnings: [], will_wait: false, cancel_cutoff_h: 24 } } : fx }),
    });
  });
  await page.goto('http://localhost:4174/lash-miniapp/');
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toBeVisible();
  expect(seen.length).toBeGreaterThanOrEqual(2);
  expect(seen.every((s) => s.method === 'POST'), `methods: ${seen.map((s) => s.method)}`).toBe(true);   // an OPTIONS preflight would show here
  const SAFE = /^(accept|accept-language|accept-encoding|content-type|content-length|origin|referer|user-agent|host|connection|sec-.*|priority|pragma)$/;
  for (const s of seen) {
    for (const h of Object.keys(s.headers)) expect(SAFE.test(h), `custom request header: ${h}`).toBe(true);
    expect(s.headers['content-type']).toMatch(/^text\/plain/);
    expect(s.url).not.toContain('?');
    const b = JSON.parse(s.body ?? '{}');
    expect(typeof b.init_data).toBe('string');
    expect(b.client_version).toBe(1);
  }
});

test('opening the app takes ONE API call; choosing a service takes ONE more', async ({ page }) => {
  await blockTelegramScript(page);
  // Count every call that goes through the API layer (the mock handler stands in for the network).
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { __calls: string[] }).__calls = calls;
    let handler: unknown;
    Object.defineProperty(window, '__MOCK_API__', {
      configurable: true,
      get: () => handler,
      set: (h: (r: string, d: unknown) => Promise<unknown>) => { handler = async (r: string, d: unknown) => { calls.push(r); return h(r, d); }; },
    });
  });
  await page.goto(`${BASE}?mock=1`);
  await expect(page.getByRole('button', { name: /Lash fill/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls)).toEqual(['bootstrap']);
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await expect(page.getByRole('button', { name: '10:30', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls)).toEqual(['bootstrap', 'availability']);
});
