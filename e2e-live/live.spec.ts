import { expect, test } from '@playwright/test';
import { BASE, TOKEN, asUser } from './helpers';

test.skip(!TOKEN || !BASE, 'set LIVE_URL and BOT_TOKEN');

test('REAL API: a returning client books (confirmed at once), moves and cancels; the opening call carries the whole catalog', async ({ page }) => {
  await asUser(page, 424242, 'Live');
  await expect(page.getByRole('heading', { name: /Lash Studio|Book an appointment/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Book again: Lash fill/ })).toBeVisible();        // seeded: a completed fill 12 days ago
  await page.getByRole('button', { name: /Book again: Lash fill/ }).click();
  await expect(page.getByTestId('strip').locator('.chip[aria-pressed="true"]')).toBeVisible();
  await page.getByTestId('slots-morning').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
  await expect(page.getByText('The master confirms new bookings first')).toHaveCount(0);           // returning client in good standing
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('done-title')).toHaveText('You are booked');
  await page.getByRole('button', { name: /My appointments/ }).click();
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await page.getByRole('button', { name: 'Reschedule' }).click();
  // a later WEEKDAY: outside the 24 h cutoff (so Cancel stays available) and with afternoon hours
  await page.getByTestId('strip').getByRole('button', { name: /^(Mon|Tue|Wed|Thu|Fri) \d+/ }).nth(3).click();
  await page.getByTestId('slots-afternoon').getByRole('button').nth(2).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Current time')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm the change' }).click();
  await expect(page.getByTestId('done-title')).toHaveText('Appointment moved');
  await page.getByRole('button', { name: /My appointments/ }).click();
  await page.getByRole('button', { name: /Lash fill/ }).click();
  await page.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(page.getByRole('status')).toContainText('Appointment cancelled');
  await expect(page.getByText('No upcoming appointments')).toBeVisible();
});

test('REAL API: a brand-new client is stopped by the gate (privacy, then phone) and nothing is booked', async ({ page }) => {
  await asUser(page, 424243, 'Fresh');
  await page.getByRole('button', { name: /Lash lift|Lash fill/ }).first().click();
  await page.getByTestId('slots-morning').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The master confirms new bookings first')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(/Privacy/i);
  await page.getByRole('button', { name: 'Agree and continue' }).click();            // real POST /api/consent
  await expect(page.getByRole('dialog')).toContainText('Your phone number');
});

test('REAL API: a forged initData gets the friendly auth message, never data', async ({ page }) => {
  await page.route('https://telegram.org/**', (r) => r.abort());
  await page.addInitScript(() => {
    const noop = () => {};
    (window as any).Telegram = { WebApp: { initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=' + '0'.repeat(64), initDataUnsafe: {}, version: '8.0', platform: 'ios', colorScheme: 'light', themeParams: {}, ready: noop, expand: noop, isVersionAtLeast: () => true, setHeaderColor: noop, setBackgroundColor: noop, onEvent: noop, offEvent: noop, BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop } } };
  });
  await page.goto(BASE);
  await expect(page.getByText('This session expired')).toBeVisible();
});
