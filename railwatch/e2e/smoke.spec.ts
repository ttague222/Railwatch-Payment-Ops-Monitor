import { test, expect } from '@playwright/test';

test('dashboard loads with demo mode banner and rail health overview', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Demo mode banner is always visible
  await expect(page.getByRole('banner', { name: 'Demo mode notice' })).toBeVisible();

  // Rail Health Overview section heading is present
  await expect(page.getByText('RAIL HEALTH OVERVIEW')).toBeVisible();

  // At least one rail card is rendered (ACH Standard is always first)
  await expect(page.getByText('ACH Standard')).toBeVisible();
});
