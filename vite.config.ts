import preact from '@preact/preset-vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const buildId = process.env.BUILD_ID ?? 'dev';

/** Emits version.json next to index.html. The app fetches it (no-store + query bust) to notice a stale cached bundle. */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) });
    },
  };
}

export default defineConfig({
  base: '/lash-miniapp/',
  plugins: [preact(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: { target: 'es2020', sourcemap: false, assetsInlineLimit: 0 },
  server: {
    host: true,
    port: 5173,
    // Dev through a Cloudflare quick tunnel: Vite must accept that Host header and HMR must use wss on 443.
    allowedHosts: ['.trycloudflare.com', ...(process.env.EXTRA_HOSTS?.split(',').filter(Boolean) ?? [])],   // EXTRA_HOSTS: e.g. a docker container name for live e2e
    hmr: process.env.TUNNEL ? { protocol: 'wss', clientPort: 443 } : undefined,
    // Same-origin /api in dev (so no CORS at all): proxied to the dev PHP server.
    proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:8088', changeOrigin: false } },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
