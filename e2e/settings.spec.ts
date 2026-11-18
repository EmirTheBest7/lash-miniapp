import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const open = async (page: Page, q = '', role = 'owner') => { await blockTelegramScript(page); await page.goto(`${BASE}?mock=1&role=${role}&staff=2${q}`); await page.getByRole('tab', { name: 'Settings' }).click(); };
const shot = async (page: Page, name: string) => { mkdirSync('e2e-artifacts', { recursive: true }); await page.screenshot({ path: `e2e-artifacts/${name}.png`, fullPage: true }); };
const row = (page: Page, re: RegExp) => page.getByRole('button', { name: re });
const primaries = (page: Page) => page.locator('.btn:not(.secondary)').count();

test('Settings home (owner): a progress card and category rows, nothing else - no checklist wall, one primary button, every row one line', async ({ page }) => {
  await open(page);
  for (const name of ['Studio', 'Services', 'Schedule', 'Bookings and rules', 'After the visit', 'Marketing', 'Vouchers', 'Staff', 'Help', 'System']) {
    await expect(row(page, new RegExp('^' + name))).toBeVisible();
  }
  await expect(page.getByText('✅')).toHaveCount(0);
  await expect(page.getByText('❌')).toHaveCount(0);
  expect(await primaries(page)).toBe(1);
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.cell .c-title')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(clipped, 'no row title is clipped').toEqual([]);
  await shot(page, 'settings-home-owner');
});

test('Settings home (administrator): every business row, no System, no technical words; the setup count excludes keys and automation', async ({ page }) => {
  await open(page, '', 'admin');
  await expect(row(page, /^Studio/)).toBeVisible();
  await expect(row(page, /^Marketing/)).toBeVisible();
  await expect(row(page, /^System/)).toHaveCount(0);
  await expect(page.getByTestId('setup-card')).toContainText('of 9');
  await page.getByRole('button', { name: 'Full list' }).click();
  await expect(page.getByText(/BACKUP_KEY|server/i)).toHaveCount(0);
});

test('Settings home (master): only Schedule, After the visit (preview) and Help; no card, no owner screens', async ({ page }) => {
  await open(page, '', 'master');
  await expect(page.getByTestId('setup-card')).toHaveCount(0);
  for (const n of ['Schedule', 'After the visit', 'Help']) await expect(row(page, new RegExp('^' + n))).toBeVisible();
  for (const n of ['Studio', 'Marketing', 'System', 'Bookings and rules']) await expect(row(page, new RegExp('^' + n))).toHaveCount(0);
});

test('View as: the owner previews the administrator and the master (front-end only), with a banner and a way out', async ({ page }) => {
  await open(page);
  await row(page, /^System/).click();
  await page.getByRole('button', { name: 'Administrator' }).click();
  await expect(page.getByTestId('viewas')).toContainText('administrator');
  await expect(row(page, /^System/)).toHaveCount(0);
  await expect(page.getByTestId('setup-card')).toContainText('of 9');                 // the simulated administrator counts like a real one
  await expect(page.getByTestId('setup-card')).not.toContainText('placeholder');
  await expect(page.getByRole('tab', { name: 'Services' })).toBeVisible();
  await page.getByTestId('viewas').getByRole('button', { name: 'Exit' }).click();
  await expect(row(page, /^System/)).toBeVisible();
  await row(page, /^System/).click();
  await page.getByRole('button', { name: 'Master', exact: true }).click();
  await expect(page.getByTestId('viewas')).toContainText('master');
  await expect(page.getByRole('tab', { name: 'Services' })).toHaveCount(0);
  await expect(row(page, /^Marketing/)).toHaveCount(0);
  await shot(page, 'settings-viewas-master');
  await page.getByTestId('viewas').getByRole('button', { name: 'Exit' }).click();
  await expect(row(page, /^System/)).toBeVisible();
});

test('language tabs: an empty language is marked, Translate drafts only the empty ones for review, and the street is refused inline', async ({ page }) => {
  await open(page);
  await row(page, /^Studio/).click();
  const area = page.getByRole('tablist', { name: 'Public area' });
  await expect(area.getByRole('tab', { name: /RU ○/ })).toBeVisible();
  await area.getByRole('tab', { name: /CS/ }).click();
  await page.getByLabel('Public area CS').fill('Praha 4');
  await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
  await page.getByRole('button', { name: 'Translate' }).click();
  await expect(page.getByText('Translation drafts')).toBeVisible();
  await expect(page.getByLabel('RU')).toHaveValue('[ru] Praha 4');
  await page.getByLabel('RU').fill('Прага 4');
  await page.getByRole('button', { name: 'Use' }).click();
  await area.getByRole('tab', { name: /RU/ }).click();
  await expect(page.getByLabel('Public area RU')).toHaveValue('Прага 4');
  await expect(area.getByRole('tab', { name: /○/ })).toHaveCount(0);               // every empty language was drafted: no mark is left
  await area.getByRole('tab', { name: /CS/ }).click();
  await page.getByLabel('Public area CS').fill('Testovací 1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('exact address');
  await shot(page, 'settings-studio-langtabs');
});

test('Translate is hidden when the AI is off', async ({ page }) => {
  await open(page, '&notranslate=1');
  await row(page, /^Studio/).click();
  await page.getByRole('tab', { name: /^CS/ }).first().click();
  await page.getByLabel('Public area CS').fill('Praha 4');
  await expect(page.getByRole('button', { name: 'Translate' })).toHaveCount(0);
});

for (const [lang, theme] of [['cs', 'light'], ['ru', 'dark'], ['uk', 'light'], ['en', 'dark']] as const) {
  test(`every Settings screen fits a 320 px phone with one primary button and no clipped titles: ${lang} / ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page, `&lang=${lang}&theme=${theme}&platform=android`);
    const check = async (label: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${label}: horizontal scroll`).toBeLessThanOrEqual(0);
      expect(await primaries(page), `${label}: primary buttons`).toBeLessThanOrEqual(1);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.cell .c-title, h1.large')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      expect(clipped, `${label}: clipped titles`).toEqual([]);
    };
    await check('home');
    const rows = await page.locator('.section .cell.has-icon').count();
    for (let i = 0; i < rows; i++) {
      await page.locator('.section .cell.has-icon').nth(i).click();
      await page.waitForTimeout(150);
      if (await page.locator('.back-row').count()) { await check(`row ${i}`); await page.locator('.back-row button').click(); }
      else await page.getByRole('tab').last().click();                       // a row that jumped to a tab: come back to Settings
    }
  });
}
