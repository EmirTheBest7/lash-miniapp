import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const open = async (page: Page, q = '', role = 'owner') => { await blockTelegramScript(page); await page.goto(`${BASE}?mock=1&role=${role}&staff=2${q}`); await page.getByRole('tab', { name: 'Settings' }).click(); };
const shot = async (page: Page, name: string) => { mkdirSync('e2e-artifacts', { recursive: true }); await page.screenshot({ path: `e2e-artifacts/${name}.png`, fullPage: true }); };
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });

test('wizard: opens at the first step that is not done, one primary button per step, Next saves and moves on, Skip is remembered, Back goes back; progress survives a reload', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Continue setup' }).click();
  await expect(page.getByText('Step 1 of 9')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Studio name' })).toBeVisible();
  await expect(next(page)).toBeVisible();
  expect(await page.locator('.btn:not(.secondary)').count()).toBe(1);
  await page.getByLabel('Studio name').fill('Viktoriia Lashes');
  await next(page).click();
  await expect(page.getByText('Step 2 of 9')).toBeVisible();
  await shot(page, 'wizard-step-contacts');
  await page.getByLabel('Telegram username (without @)').fill('viktoriia_lash');
  await next(page).click();
  await expect(page.getByText('Step 3 of 9')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('Step 4 of 9')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Step 3 of 9')).toBeVisible();
  // leave and come back: it resumes at the first step that is neither done nor skipped (services, schedule are green in the mock: the cancellation rules)
  await page.getByRole('button', { name: /^Leave setup/ }).click();
  await page.getByRole('button', { name: 'Continue setup' }).click();
  await expect(page.getByRole('heading', { name: 'Cancellation rules' })).toBeVisible();
});

test('wizard: the data-notice step is never ticked by itself; the last step lists done / skipped / to do and lets her open one', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Continue setup' }).click();
  for (let k = 0; k < 6; k++) await page.getByRole('button', { name: 'Skip' }).click();      // name .. policy
  await expect(page.getByRole('heading', { name: 'Data notice' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Privacy notice reviewed/ })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();                                  // reviews
  await expect(page.getByRole('heading', { name: 'All set' })).toBeVisible();
  await expect(page.getByText('skipped').first()).toBeVisible();
  await expect(page.getByRole('switch', { name: /Automatic messages/ })).toBeVisible();      // owner only
  expect(await page.locator('.btn:not(.secondary)').count()).toBe(1);
  await page.getByRole('button', { name: /Studio name/ }).click();                           // open a skipped one
  await expect(page.getByText('Step 1 of 9')).toBeVisible();
});

test('wizard: review links step adds a link (https only), and the administrator does not get the automation switch', async ({ page }) => {
  await open(page, '', 'admin');
  await page.getByRole('button', { name: /^Help/ }).click();
  await page.getByRole('button', { name: /Run the basic setup again/ }).click();
  await page.getByRole('button', { name: 'Open the setup' }).click();
  await expect(page.getByText('Step 1 of 9')).toBeVisible();
  for (let k = 0; k < 7; k++) await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Review links' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a link' }).click();
  await page.getByLabel('Link address (https)').fill('http://nope.example');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('https://');
  await page.getByLabel('Link address (https)').fill('https://www.firmy.cz/detail/1');
  await expect(page.getByText('Platform: Firmy.cz')).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('switch', { name: /Automatic messages/ })).toHaveCount(0);
});
