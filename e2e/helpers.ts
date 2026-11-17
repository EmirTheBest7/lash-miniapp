import type { Page } from '@playwright/test';
/** The real telegram-web-app.js is not loaded in tests (no network, no Telegram): the dev mock stands in for window.Telegram. */
export async function blockTelegramScript(page: Page): Promise<void> {
  await page.route('https://telegram.org/**', (r) => r.abort());
}
