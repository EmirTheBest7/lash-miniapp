import { expect, test } from '@playwright/test';
import { blockTelegramScript } from './helpers';

test('dev perf log: owner load prints one table with the load split (mock build, never in production)', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => { if (m.text().includes('[perf]')) logs.push(m.text()); });
  await blockTelegramScript(page);
  await page.goto('/lash-miniapp/?mock=1&role=owner&staff=2&perf');
  await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
  await expect.poll(() => logs.length).toBeGreaterThan(0);
  const t = logs.join('\n');
  for (const k of ['js-start', 'tg-script-ready', 'api:bootstrap:start', 'api:bootstrap:end', 'client-bootstrap-rendered']) expect(t).toContain(k);
});
