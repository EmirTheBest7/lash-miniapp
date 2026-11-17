import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { blockTelegramScript } from './helpers';

const BASE = '/lash-miniapp/';
const open = async (page: Page, q = '') => { await blockTelegramScript(page); await page.goto(`${BASE}?mock=1&role=owner&staff=2${q}`); };
const shot = async (page: Page, name: string) => { mkdirSync('e2e-artifacts', { recursive: true }); await page.screenshot({ path: `e2e-artifacts/${name}.png`, fullPage: true }); };
const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text })).toBeVisible();
const col = (page: Page, id: number) => page.getByTestId(`col-${id}`);

test('owner sees every staff calendar side by side with who is booked where; non-working time is shaded', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('head-1')).toHaveText('Jana');
  await expect(page.getByTestId('head-2')).toHaveText('Eva');
  await expect(col(page, 1).getByRole('button', { name: /Eva Kovářová/ })).toBeVisible();
  await expect(col(page, 1).getByRole('button', { name: /Tereza Malá/ })).toBeVisible();
  await expect(col(page, 2).getByRole('button', { name: /Bára Svobodová/ })).toBeVisible();
  await expect(col(page, 1).locator('.cal-open')).toHaveCount(1);              // one working interval = white; everything else hatched
  await expect(col(page, 1).locator('.ev-buf')).toHaveCount(2);                // the buffer after each appointment is drawn
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await shot(page, 'admin-calendar-all');
});

test('switching to one staff member shows only that calendar; the day navigation moves the date', async ({ page }) => {
  await open(page);
  await page.getByTestId('staff-filter').getByRole('button', { name: 'Eva' }).click();
  await expect(page.getByTestId('head-1')).toHaveCount(0);
  await expect(col(page, 2).getByRole('button', { name: /Bára/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByTestId('cal-date')).toContainText('Tuesday');
  await expect(col(page, 2).getByRole('button')).toHaveCount(0);
  await page.getByTestId('staff-filter').getByRole('button', { name: 'All' }).click();
  await expect(page.getByTestId('head-1')).toBeVisible();
});

test('appointment card: contact, person, and reassign to another person in one tap', async ({ page }) => {
  await open(page);
  await col(page, 1).getByRole('button', { name: /Eva Kovářová/ }).click();
  const card = page.getByRole('dialog');
  await expect(card).toContainText('+420777000111');
  await expect(card).toContainText('Jana');
  await card.getByRole('button', { name: 'Eva', exact: true }).click();
  await toast(page, 'Reassigned');
  await expect(col(page, 2).getByRole('button', { name: /Eva Kovářová/ })).toBeVisible();
  await expect(col(page, 1).getByRole('button', { name: /Eva Kovářová/ })).toHaveCount(0);
});

test('move = pick "Move", then tap the new time in any column (time and person change together); a busy time is refused', async ({ page }) => {
  await open(page);
  await col(page, 1).getByRole('button', { name: /Tereza Malá/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move' }).click();
  await expect(page.getByText(/Tap the new time for Tereza Malá/)).toBeVisible();
  await col(page, 2).click({ position: { x: 40, y: 400 } });                 // ~16:00 in Eva's column
  await toast(page, 'Appointment moved');
  await expect(col(page, 2).getByRole('button', { name: /Tereza Malá/ })).toBeVisible();
  // now move Bára onto Tereza's time: refused (overlap is never allowed, even when the master offers to place it anyway)
  await col(page, 2).getByRole('button', { name: /Bára/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move' }).click();
  await col(page, 2).click({ position: { x: 40, y: 400 } });
  await toast(page, 'not free');
});

test('manual booking by tapping an empty time: search a client, pick service, the person is preselected; it appears in the column', async ({ page }) => {
  await open(page);
  await col(page, 2).click({ position: { x: 40, y: 400 } });
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel('Start')).toHaveValue('16:00');
  await sheet.getByLabel('Search').fill('Tereza');
  await sheet.getByRole('button', { name: /Tereza Malá/ }).click();
  await sheet.getByRole('button', { name: /Lash lift/ }).click();
  await expect(sheet.getByRole('button', { name: 'Eva', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByRole('button', { name: 'Create appointment' }).click();
  await toast(page, 'Appointment created');
  await expect(col(page, 2).getByRole('button', { name: /Tereza Malá/ })).toBeVisible();
});

test('a person who does not do an add-on is not offered for it in manual booking', async ({ page }) => {
  await open(page);
  await col(page, 2).click({ position: { x: 40, y: 400 } });
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /Lash lift/ }).click();
  await expect(sheet.getByRole('button', { name: 'Eva', exact: true })).toBeVisible();
  await sheet.getByRole('switch', { name: 'Lash tint' }).click();                // Eva does not do the tint
  await expect(sheet.getByRole('button', { name: 'Eva', exact: true })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Jana', exact: true })).toBeVisible();
});

test('day off for one person: her column turns fully non-working; "back to normal" restores it', async ({ page }) => {
  await open(page);
  await page.getByTestId('head-2').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Day off' }).click();
  await toast(page, 'Saved');
  await page.keyboard.press('Escape');
  await expect(col(page, 2).locator('.cal-open')).toHaveCount(0);
  await expect(col(page, 1).locator('.cal-open')).toHaveCount(1);
  await page.getByTestId('head-2').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Back to normal hours' }).click();
  await page.keyboard.press('Escape');
  await expect(col(page, 2).locator('.cal-open')).toHaveCount(1);
});

test('blocked time is drawn with its reason', async ({ page }) => {
  await open(page);
  await page.getByTestId('head-1').click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Reason').fill('Training');
  await d.getByRole('button', { name: 'Block this time' }).click();
  await page.keyboard.press('Escape');
  await expect(col(page, 1).locator('.blk')).toHaveText('Training');
});

test('staff tab: add a person, set who does what and individual weekly hours with a break', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Staff' }).click();
  await expect(page.getByRole('button', { name: /Jana · me/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add staff member' }).click();
  await page.getByLabel('Name').fill('Nora');
  await page.getByRole('switch', { name: 'Lash tint' }).click();                   // Nora does not do tint
  const mon = page.getByTestId('day-1');
  await mon.getByRole('button', { name: 'Add interval or break' }).click();
  await expect(mon.locator('.ivl')).toHaveCount(2);                                // 10-18 and a second interval = a break between
  await page.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Saved');
  await expect(page.getByRole('button', { name: /Nora/ })).toBeVisible();
  await shot(page, 'admin-staff');
});

test('linking another person: only an id that is a master in the bot settings is accepted', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Staff' }).click();
  await page.getByRole('button', { name: /Eva/ }).click();
  await page.getByLabel('Telegram ID of this person').fill('777');
  await page.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'not listed as a master');
  await page.getByLabel('Telegram ID of this person').fill('900002');
  await page.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Saved');
});

test('services tab: duration and buffer are explicit; the reservation shown to the master = duration + buffer', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Services' }).click();
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await expect(page.getByTestId('reserved')).toContainText('Reserved: 1 h 30 min');
  await page.getByLabel('Buffer (min)').fill('30');
  await expect(page.getByTestId('reserved')).toContainText('Reserved: 1 h 45 min');
  await expect(page.getByTestId('reserved')).toContainText('client sees 1 h 15 min');
  await page.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Saved');
  await expect(page.getByRole('button', { name: /Lash fill.*30 min buffer/ })).toBeVisible();
});

test('a master (not owner) sees only their own calendar and no Services tab or management', async ({ page }) => {
  await blockTelegramScript(page);
  await page.goto(`${BASE}?mock=1&role=master&staff=2`);
  await expect(page.getByTestId('head-1')).toBeVisible();
  await expect(page.getByTestId('head-2')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Services' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Staff' }).click();
  await expect(page.getByRole('button', { name: 'Add staff member' })).toHaveCount(0);
});

test('staff can open the client view and come back', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Open the client view' }).click();
  await expect(page.getByRole('heading', { name: 'Lash Studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Staff app' }).click();
  await expect(page.getByTestId('head-1')).toBeVisible();
});

for (const [lang, theme, platform] of [['cs', 'light', 'ios'], ['ru', 'dark', 'android'], ['uk', 'light', 'android'], ['en', 'dark', 'ios']] as const) {
  test(`admin looks right and fits the width: ${lang} / ${theme} / ${platform}`, async ({ page }) => {
    await open(page, `&lang=${lang}&theme=${theme}&platform=${platform}`);
    await expect(page.getByTestId('head-2')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    for (let i = 0; i < await tabs.count(); i++) {
      const b = await tabs.nth(i).boundingBox();
      expect(b!.x + b!.width, `tab ${i} fits`).toBeLessThanOrEqual(390);
    }
    await shot(page, `admin-${lang}-${theme}-${platform}`);
  });
}
