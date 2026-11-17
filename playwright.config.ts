import { defineConfig } from '@playwright/test';

// Two preview servers over two builds: dist-e2e (mock API available, gallery on) and dist-xo (API base on ANOTHER origin,
// to prove that no preflight is ever triggered). Synthetic data only: CI logs and artifacts of this repo are public.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } },
  webServer: [
    { command: 'npx vite preview --outDir dist-e2e --port 4173 --strictPort', url: 'http://localhost:4173/lash-miniapp/', reuseExistingServer: false },
    { command: 'npx vite preview --outDir dist-xo --port 4174 --strictPort', url: 'http://localhost:4174/lash-miniapp/', reuseExistingServer: false },
  ],
});
