import { defineConfig } from '@playwright/test';

// MANUAL integration run against a REAL PHP API (not in CI; needs the backend dev stack). Synthetic users only.
//   LIVE_URL=http://<vite-host>:5174/lash-miniapp/  BOT_TOKEN=<dev bot token for the signature>  npx playwright test -c playwright.live.config.ts
export default defineConfig({
  testDir: 'e2e-live',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: process.env.LIVE_URL, viewport: { width: 390, height: 844 } },
});
