import { expect, test } from '@playwright/test';
import { blockTelegramScript } from './helpers';

const calls = (page: import('@playwright/test').Page) => page.evaluate(() => ((window as unknown as { __mockCalls?: { route: string; data: unknown }[] }).__mockCalls ?? []).map((c) => c.route));

test('dev perf log: an owner load prints one table with the load split (mock build, never in production)', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => { if (m.text().includes('[perf]')) logs.push(m.text()); });
  await blockTelegramScript(page);
  await page.goto('/lash-miniapp/?mock=1&role=owner&staff=2&perf');
  await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
  await expect.poll(() => logs.length).toBeGreaterThan(0);
  const t = logs.join('\n');
  for (const k of ['js-start', 'tg-script-ready', 'api:bootstrap:start', 'api:bootstrap:end', 'staff-bootstrap-rendered', 'first-content']) expect(t).toContain(k);
});

test('ONE bootstrap call opens the staff app: no second admin bootstrap, the admin chunk is requested as the answer arrives; client view and back use one call each', async ({ page }) => {
  await blockTelegramScript(page);
  await page.goto('/lash-miniapp/?mock=1&role=owner&staff=2');
  await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
  const first = await calls(page);
  expect(first.filter((r) => r === 'bootstrap')).toHaveLength(1);
  expect(first).not.toContain('admin/bootstrap');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /^Help/ }).click();
  await page.getByRole('button', { name: 'Client view' }).click();
  await expect(page.getByRole('button', { name: /Book|Lash/ }).first()).toBeVisible();
  const mid = await calls(page);
  expect(mid.filter((r) => r === 'bootstrap')).toHaveLength(2);
  expect(mid).not.toContain('admin/bootstrap');
});

test('a client opens with exactly one call and never loads the admin chunk', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => { if (/admin-[\w-]+\.(js|css)/.test(r.url())) chunks.push(r.url()); });
  await blockTelegramScript(page);
  await page.goto('/lash-miniapp/?mock=1');
  await expect(page.getByRole('button', { name: /Lash/ }).first()).toBeVisible();
  expect(await calls(page)).toEqual(['bootstrap']);
  expect(chunks).toHaveLength(0);
});
