import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // ─── Dev proxy — eliminates corsproxy.io dependency in local development ──────
  //
  // FRED and Marketaux APIs block direct browser requests (CORS). In dev mode,
  // Vite proxies /api/fred and /api/marketaux to the real upstream APIs server-side,
  // so no third-party proxy service is needed.
  //
  // PRODUCTION: These routes should be handled by a real backend (Next.js API routes,
  // Express, etc.) so API keys never reach the browser and caching is persistent.
  // ──────────────────────────────────────────────────────────────────────────────
  server: {
    proxy: {
      '/api/fred': {
        target: 'https://api.stlouisfed.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fred/, '/fred'),
      },
      '/api/marketaux': {
        target: 'https://api.marketaux.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/marketaux/, ''),
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
})
