import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  // Do not start a web server automatically — CI starts it manually with `npm run dev &`
  // For local E2E runs, start `npm run dev` first, then run `npm run test:e2e`
});
