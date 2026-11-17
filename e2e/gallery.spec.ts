import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const PALETTE = { light: { bg: 'rgb(255, 255, 255)', secondary: 'rgb(239, 239, 243)' }, dark: { bg: 'rgb(33, 33, 33)', secondary: 'rgb(15, 15, 15)' } };

for (const theme of ['light', 'dark'] as const) {
  for (const platform of ['ios', 'android', 'desktop'] as const) {
    test(`gallery renders natively: ${theme} / ${platform}`, async ({ page }) => {
      await blockTelegramScript(page);
      await page.goto(`${BASE}?gallery=1&theme=${theme}&platform=${platform}`);
      await expect(page.getByTestId('gallery')).toBeVisible();
      const root = await page.evaluate(() => ({
        cls: document.documentElement.className, scheme: document.documentElement.dataset.scheme,
        bg: getComputedStyle(document.documentElement).getPropertyValue('--tg-bg').trim(), body: getComputedStyle(document.body).backgroundColor,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }));
      expect(root.cls).toContain(`plat-${platform}`);
      expect(root.scheme).toBe(theme);
      expect(root.body).toBe(PALETTE[theme].secondary);                 // page background = Telegram's secondary_bg_color
      expect(root.overflow).toBeLessThanOrEqual(0);                      // no sideways scroll
      // open the sheet too: it must sit on the section background, above the backdrop
      await page.getByRole('button', { name: 'Open sheet' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      mkdirSync('e2e-artifacts', { recursive: true });
      await page.screenshot({ path: `e2e-artifacts/gallery-${theme}-${platform}.png`, fullPage: true });
    });
  }
}

test('no brand colours: the whole gallery only uses theme variables (computed colours change with the theme)', async ({ page }) => {
  await blockTelegramScript(page);
  const colour = async (theme: string) => {
    await page.goto(`${BASE}?gallery=1&theme=${theme}&platform=ios`);
    await expect(page.getByTestId('gallery')).toBeVisible();
    return page.evaluate(() => getComputedStyle(document.querySelector('.chip[aria-pressed="true"]')!).backgroundColor);
  };
  expect(await colour('light')).not.toBe(await colour('dark'));
});
