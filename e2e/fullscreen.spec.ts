import { expect, test, type Page } from '@playwright/test';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const go = async (page: Page, q: string) => { await blockTelegramScript(page); await page.goto(`${BASE}?mock=1&role=owner&staff=2&${q}`); await page.locator('#app').waitFor(); await page.locator('.adm-tabs').waitFor(); };
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __tg: Record<string, number> }).__tg);
const cssPx = (page: Page, v: string) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), v);

test('phone (iOS) with Bot API 8.0: asks for fullscreen (not expand), disables vertical swipes, and keeps content below the notch + Telegram controls (safe + content-safe, summed)', async ({ page }) => {
  await go(page, 'platform=ios&safe=47,34&csafe=56,0');
  const c = await calls(page);
  expect(c.requestFullscreen).toBe(1);
  expect(c.expand).toBe(0);
  expect(c.disableVerticalSwipes).toBe(1);
  expect(await cssPx(page, '--safe-top')).toBe('103px');
  expect(await cssPx(page, '--safe-bottom')).toBe('34px');
  const pad = await page.evaluate(() => getComputedStyle(document.getElementById('app')!).paddingTop);
  expect(pad).toBe('103px');
  const tabsTop = await page.evaluate(() => getComputedStyle(document.querySelector('.adm-tabs')!).top);
  expect(tabsTop).toBe('103px');
  const first = await page.locator('.adm-tabs').boundingBox();
  expect(first!.y).toBeGreaterThanOrEqual(103 - 1);          // the tab bar never sits under the controls
});

test('Android also goes fullscreen; Telegram refusing it (fullscreenFailed) falls back to expand()', async ({ page }) => {
  await go(page, 'platform=android&fsfail=1');
  await expect.poll(async () => (await calls(page)).expand).toBe(1);
  expect((await calls(page)).requestFullscreen).toBe(1);
});

test('desktop / web: no fullscreen at all, just expand(); an old client (< 8.0) on a phone also only expands', async ({ page }) => {
  await go(page, 'platform=tdesktop');
  let c = await calls(page);
  expect([c.requestFullscreen, c.expand]).toEqual([0, 1]);
  await go(page, 'platform=ios&v=7.6');
  c = await calls(page);
  expect([c.requestFullscreen, c.expand]).toEqual([0, 1]);
  expect(await cssPx(page, '--safe-top')).toBe('0px');
});

test('the insets follow safeAreaChanged / contentSafeAreaChanged / fullscreenChanged (rotation, entering fullscreen)', async ({ page }) => {
  await go(page, 'platform=ios&safe=0,0&csafe=0,0');
  await page.evaluate(() => (window as unknown as { __tgFire: (e: string, p: object) => void }).__tgFire('safeAreaChanged', { safeAreaInset: { top: 20, bottom: 10, left: 0, right: 0 } }));
  expect(await cssPx(page, '--safe-top')).toBe('20px');
  await page.evaluate(() => (window as unknown as { __tgFire: (e: string, p: object) => void }).__tgFire('contentSafeAreaChanged', { contentSafeAreaInset: { top: 56, bottom: 0, left: 0, right: 0 } }));
  expect(await cssPx(page, '--safe-top')).toBe('76px');
  await page.evaluate(() => (window as unknown as { __tgFire: (e: string, p: object) => void }).__tgFire('fullscreenChanged', { contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 } }));
  expect(await cssPx(page, '--safe-top')).toBe('20px');
  expect(await cssPx(page, '--safe-bottom')).toBe('10px');
});

test('a bottom sheet keeps its buttons above the home bar', async ({ page }) => {
  await go(page, 'platform=ios&safe=47,34&csafe=56,0');
  await page.locator('.cal-col').first().click({ position: { x: 20, y: 200 } }).catch(() => undefined);
  const pad = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')!).paddingBottom);
  expect(parseInt(pad, 10)).toBeGreaterThanOrEqual(34);          // at least the home-bar inset (plus the sheet's own padding)
});
