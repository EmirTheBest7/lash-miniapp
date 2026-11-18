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

test('linking another person: the owner types any Telegram id and that person becomes a master', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Staff' }).click();
  await page.getByRole('button', { name: /Eva/ }).click();
  await page.getByLabel('Telegram ID of this person').fill('777');
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

test('services: add a service and an add-on, rename, then delete one (unused = removed, used = hidden)', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Services' }).click();
  await page.getByRole('button', { name: 'New service' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Enter a name');
  await page.getByLabel(/^Name · English/).fill('Brow lamination');
  await page.getByLabel('Category').selectOption({ label: 'New category…' });
  await page.getByPlaceholder('Category name').fill('Brows');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Brow lamination/ })).toBeVisible();
  await page.getByRole('button', { name: 'New add-on' }).click();
  await page.getByLabel(/^Name · English/).fill('Brow tint');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Brow tint/ })).toBeVisible();
  // delete needs a second tap
  await page.getByRole('button', { name: /Brow tint/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(page.getByRole('button', { name: /Brow tint/ })).toHaveCount(0);
});

test('administrator: the owner makes a person an admin (needs a Telegram ID) and the list shows the badge', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Staff' }).click();
  await page.getByRole('button', { name: /Eva/ }).click();
  await expect(page.getByText('Administrator', { exact: true })).toHaveCount(0);          // no Telegram ID yet: nothing to grant
  await page.getByLabel('Telegram ID of this person').fill('783917247');
  await page.getByRole('switch', { name: 'Administrator' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Saved');
  await expect(page.getByRole('button', { name: /Eva · Admin/ })).toBeVisible();
});

test('loyalty settings: switch it on, set visits and percent; approve a waiting discount', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByTestId('loy-1')).toBeVisible();
  await page.getByRole('switch', { name: 'Reward regular clients' }).click();
  await page.getByLabel('Visits needed').fill('5');
  await page.getByLabel('Discount (%)').fill('15');
  await page.getByLabel('Discount (%)').blur();
  await toast(page, 'Saved');
  await page.getByTestId('loy-1').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('loy-1')).toHaveCount(0);
});

test('staff delete: a person with bookings is refused with a hint; a new empty person is removed after a second tap', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Staff' }).click();
  await page.getByRole('button', { name: /Eva/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Tap again to delete' }).click();
  await toast(page, 'Past bookings exist');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Add staff member' }).click();
  await page.getByLabel('Name').fill('Temp');
  await page.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Saved');
  await page.getByRole('button', { name: /Temp/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Tap again to delete' }).click();
  await toast(page, 'Deleted');
  await expect(page.getByRole('button', { name: /Temp/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Eva/ })).toBeVisible();
});

test('offers broadcast: admins see the audience, send a test, and a real send needs a second tap', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByTestId('bc-audience')).toContainText('2 of 5 clients');
  await page.getByLabel('Message', { exact: true }).fill('-20% on lashes this week');
  await page.getByRole('button', { name: 'Send a test to me' }).click();
  await toast(page, 'Test sent to you');
  await page.getByRole('button', { name: 'Send to clients' }).click();
  await page.getByRole('button', { name: 'Tap again: send to 2' }).click();
  await toast(page, 'Queued for 2 clients');
});

test('reminder settings: switches and hours save; a first reminder shorter than the cancel cutoff shows a warning; backups say when the key is missing', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Reminders and schedule')).toBeVisible();
  await expect(page.getByTestId('auto-off')).toBeVisible();
  await page.getByRole('switch', { name: /Automatic messages/ }).click();
  await toast(page, 'Saved');
  await expect(page.getByTestId('auto-off')).toHaveCount(0);
  await expect(page.getByTestId('backup-status')).toContainText('BACKUP_KEY is missing');
  await expect(page.getByLabel('Hours before (0 = automatic: cancel cutoff + 2)')).toHaveValue('0');
  await page.getByLabel('Hours before (0 = automatic: cancel cutoff + 2)').fill('20');
  await page.getByLabel('Hours before (0 = automatic: cancel cutoff + 2)').blur();
  await toast(page, 'Saved');
  await expect(page.getByTestId('rem1-warn')).toBeVisible();
  await page.getByRole('switch', { name: 'Second reminder (address and pre-care)' }).click();
  await toast(page, 'Saved');
  await expect(page.getByLabel('Hours before', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('bc-audience')).toContainText('1 skipped');
});

test('a master (not an admin) does not see the broadcast form', async ({ page }) => {
  await blockTelegramScript(page);
  await page.goto(`${BASE}?mock=1&role=master&staff=2`);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Offers to clients')).toHaveCount(0);
});

test('vouchers tab (owner): create a value voucher, the code is shown once, list shows it with the year; extend and void; a master has no tab', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Vouchers' }).click();
  await expect(page.getByTestId('vch-empty')).toBeVisible();
  await page.getByRole('button', { name: /Voucher settings/ }).click();
  await page.getByLabel('Minimum amount (Kč)').fill('300');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: /New voucher/ }).click();
  await expect(page.getByLabel('Amount (Kč, at least 300)')).toBeVisible();
  await page.getByLabel('Amount (Kč, at least 300)').fill('500');
  await page.getByRole('button', { name: 'Create voucher' }).click();
  await expect(page.getByTestId('vch-code')).toHaveText('MOCK-ABCD-EFGH-JKMN');
  await expect(page.getByTestId('vch-link')).toContainText('t.me/mock_bot?start=gv_');
  await expect(page.getByTestId('vch-qr')).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download QR' }).click();
  expect((await dl).suggestedFilename()).toBe('voucher-qr.png');
  const dl2 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download printable card' }).click();
  expect((await dl2).suggestedFilename()).toBe('voucher-card.png');
  await expect(page.getByTestId('vch-card')).toBeVisible();
  await page.getByRole('button', { name: 'Send card to my chat' }).click();
  await toast(page, 'Card sent to your chat');
  await shot(page, 'admin-voucher-created');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /…MOCK · 500/ }).click();
  await expect(page.getByText(/20\d\d/).first()).toBeVisible();              // the expiry date carries the year
  await page.getByRole('button', { name: '+3 months' }).click();
  await page.getByRole('button', { name: 'Reissue', exact: true }).click();
  await page.getByRole('button', { name: /Tap again: old code stops/ }).click();
  await expect(page.getByTestId('vch-code')).toHaveText('NEW1-ABCD-EFGH-JKMN');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /…MOCK · 500 Kč void/ })).toBeVisible();          // the old one is void in the list
  await page.getByRole('button', { name: /…NEW1 · 500 Kč active/ }).click();
  await page.getByRole('button', { name: 'Void', exact: true }).click();
  await page.getByRole('button', { name: 'Tap again to void' }).click();
  await expect(page.getByText('void', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.goto(`${BASE}?mock=1&role=master&staff=2`);
  await expect(page.getByRole('tab', { name: 'Vouchers' })).toHaveCount(0);
});

test('after the visit (owner): review link must be https, delay fields appear once a link is set, service aftercare + fill days are editable; masters see none of it', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('After the visit')).toBeVisible();
  await expect(page.getByLabel('Ask for a review after (hours)')).toHaveCount(0);
  await page.getByLabel('Google review link (https, pasted from Google)').fill('http://nope.example/x');
  await page.getByLabel('Google review link (https, pasted from Google)').blur();
  await expect(page.getByLabel('Ask for a review after (hours)')).toHaveCount(0);
  await page.getByLabel('Google review link (https, pasted from Google)').fill('https://g.page/r/abc/review');
  await page.getByLabel('Google review link (https, pasted from Google)').blur();
  await expect(page.getByLabel('Ask for a review after (hours)')).toBeVisible();
  await shot(page, 'admin-after-visit-settings');
  await page.getByRole('tab', { name: 'Services' }).click();
  await page.getByRole('button', { name: /Lash extensions/ }).first().click();
  await page.getByLabel('Aftercare text · English').fill('Keep lashes dry for 24 h.');
  await page.getByLabel('Fill after (days)').fill('21');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(page, 'Saved');
  await page.goto(`${BASE}?mock=1&role=master&staff=2`);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('After the visit')).toHaveCount(0);
});
