import { expect, test, type Page } from '@playwright/test';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const open = async (page: Page, q = '') => { await blockTelegramScript(page); await page.goto(`${BASE}?mock=1${q}`); };

test('one person only: the staff step does not exist', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await expect(page.getByTestId('strip')).toBeVisible();
  await expect(page.getByTestId('staff')).toHaveCount(0);
});

test('two people: choose a specialist (or Any), it is sent to the API, shown in the summary and on the done screen', async ({ page }) => {
  await open(page, '&staff=2');
  const calls = async () => (await page.evaluate(() => (window as unknown as { __mockCalls: { route: string; data: { staff?: number } }[] }).__mockCalls)).map((c) => ({ route: c.route, staff: c.data.staff }));
  await page.getByRole('button', { name: /Lash fill/ }).click();
  const staff = page.getByTestId('staff');
  await expect(staff.getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true');
  await expect(staff.getByRole('button', { name: 'Jana' })).toBeVisible();
  await staff.getByRole('button', { name: 'Eva' }).click();
  await expect(page.getByText('Lifting and tinting')).toBeVisible();
  await page.getByRole('button', { name: '11:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Specialist')).toBeVisible();
  await expect(page.getByText('Eva', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('done-title')).toBeVisible();
  await expect(page.getByText(/· Eva/)).toBeVisible();
  const seen = await calls();
  expect(seen.some((c) => c.route === 'availability' && c.staff === 2), JSON.stringify(seen)).toBe(true);
  expect(seen.some((c) => c.route === 'appointments/create' && c.staff === 2)).toBe(true);
  // My appointments names the person
  await page.getByRole('button', { name: /My appointments/ }).click();
  await expect(page.getByText(/Lash fill · 1 h 15 min · Eva/)).toBeVisible();
});

test('"Any" sends no staff id (the server picks inside the booking transaction)', async ({ page }) => {
  await open(page, '&staff=2');
  await page.getByRole('button', { name: /Lash lift/ }).click();
  await page.getByRole('button', { name: '11:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('done-title')).toBeVisible();
  const create = (await page.evaluate(() => (window as unknown as { __mockCalls: { route: string; data: { staff?: number } }[] }).__mockCalls)).find((c) => c.route === 'appointments/create')!;
  expect(create.data.staff).toBeUndefined();
});

test('an add-on that only some people do removes the choice (nobody is offered who cannot do it)', async ({ page }) => {
  await open(page, '&staff=2');
  await page.getByRole('button', { name: /Lash lift/ }).click();
  await expect(page.getByTestId('staff')).toBeVisible();
  await page.getByRole('button', { name: /Add-ons|Extras/ }).click();
  await page.getByRole('switch', { name: 'Lash tint' }).click();
  await page.getByRole('button', { name: 'Done' }).first().click();
  await expect(page.getByTestId('staff')).toHaveCount(0);
});
