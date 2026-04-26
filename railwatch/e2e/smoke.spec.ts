import { test, expect } from '@playwright/test';

test('dashboard loads with demo mode banner and rail health overview', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Demo mode notice — role="status" is correct for a persistent notice bar
  // (a page should only have one banner landmark)
  await expect(page.getByRole('status', { name: 'Demo mode notice' })).toBeVisible();

  // Rail Health Overview section heading is present
  await expect(page.getByText('RAIL HEALTH OVERVIEW')).toBeVisible();

  // ACH Standard rail card heading — heading role ensures exactly one match
  await expect(page.getByRole('heading', { name: 'ACH Standard' })).toBeVisible();
});
