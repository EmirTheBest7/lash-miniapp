import { expect, test } from '@playwright/test';
import { BASE, TOKEN, asUser } from './helpers';

test.skip(!TOKEN || !BASE, 'set LIVE_URL and BOT_TOKEN');
const VIEWPORT = { width: 390, height: 844 };

test('REAL API: the owner adds a second person; a customer picks her; the owner sees it in her column and reassigns it', async ({ browser }) => {
  const owner = await (await browser.newContext({ viewport: VIEWPORT })).newPage();
  await asUser(owner, 900001, 'Owner');                      // OWNER_IDS of the throwaway backend
  await expect(owner.getByRole('tab', { name: 'Calendar' })).toBeVisible();
  await expect(owner.getByTestId('cal')).toBeVisible();

  // 1. add Nora (hours copied from the first person)
  await owner.getByRole('tab', { name: 'Staff' }).click();
  await owner.getByRole('button', { name: 'Add staff member' }).click();
  await owner.getByLabel('Name').fill('Nora');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByRole('status')).toContainText('Saved');
  await expect(owner.getByRole('button', { name: /Nora/ })).toBeVisible();

  // 2. a returning customer now sees the choice and picks Nora
  const cust = await (await browser.newContext({ viewport: VIEWPORT })).newPage();
  await asUser(cust, 424242, 'Live');
  await cust.getByRole('button', { name: /Lash fill/ }).first().click();
  const staff = cust.getByTestId('staff');
  await expect(staff.getByRole('button', { name: 'Any' })).toBeVisible();
  await expect(staff.getByRole('button', { name: 'Master' })).toBeVisible();
  await staff.getByRole('button', { name: 'Nora' }).click();
  await cust.getByTestId('strip').getByRole('button', { name: /^(Mon|Tue|Wed|Thu|Fri) \d+/ }).nth(3).click();
  await cust.getByTestId('slots-afternoon').getByRole('button').nth(2).click();
  await cust.getByRole('button', { name: 'Continue' }).click();
  await expect(cust.getByText('Specialist')).toBeVisible();
  await cust.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(cust.getByTestId('done-title')).toHaveText('You are booked');
  await expect(cust.getByText(/· Nora/)).toBeVisible();

  // 3. the owner finds the booking in Nora's column (walk forward to its day)
  await owner.getByRole('tab', { name: 'Calendar' }).click();
  const inNora = owner.getByLabel('Nora').getByRole('button', { name: /Live Tester/ });
  for (let i = 0; i < 14 && !(await inNora.isVisible()); i++) {
    await owner.getByRole('button', { name: 'Next day' }).click();
    await owner.waitForTimeout(250);
  }
  await expect(inNora).toBeVisible();
  await expect(owner.getByLabel('Master').getByRole('button', { name: /Live Tester/ })).toHaveCount(0);

  // 4. reassign to the first person in one tap: the same time, another column
  await inNora.click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Master', exact: true }).click();
  await expect(owner.getByRole('status')).toContainText('Reassigned');
  await expect(owner.getByLabel('Master').getByRole('button', { name: /Live Tester/ })).toBeVisible();
  await expect(owner.getByLabel('Nora').getByRole('button', { name: /Live Tester/ })).toHaveCount(0);

  // 5. the customer's list shows who it is with now
  await cust.reload();
  await cust.getByRole('button', { name: /My appointments/ }).click();
  await expect(cust.getByText(/Lash fill.*· Master/)).toBeVisible();
  // clean up so the other live tests start from the same state: the customer cancels it (still outside the cutoff)
  await cust.getByRole('button', { name: /Lash fill/ }).click();
  await cust.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(cust.getByText('No upcoming appointments')).toBeVisible();
});

test('REAL API: services - the owner changes the buffer; a master (non-owner) cannot manage and sees no Services tab', async ({ browser }) => {
  const owner = await (await browser.newContext({ viewport: VIEWPORT })).newPage();
  await asUser(owner, 900001, 'Owner');
  await owner.getByRole('tab', { name: 'Services' }).click();
  await owner.getByRole('button', { name: /Lash fill/ }).first().click();
  await owner.getByLabel('Buffer (min)').fill('25');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByRole('status')).toContainText('Saved');
  await expect(owner.getByRole('button', { name: /Lash fill.*25 min buffer/ })).toBeVisible();

  const master = await (await browser.newContext({ viewport: VIEWPORT })).newPage();
  await asUser(master, 900002, 'Mina');                      // MASTER_IDS
  await expect(master.getByRole('tab', { name: 'Calendar' })).toBeVisible();
  await expect(master.getByRole('tab', { name: 'Services' })).toHaveCount(0);
});
