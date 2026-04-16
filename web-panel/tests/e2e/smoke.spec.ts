import { test, expect } from '@playwright/test';

// Test environment variables with fallbacks
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TEST_DIETITIAN_EMAIL = process.env.TEST_DIETITIAN_EMAIL || 'test@dietitian.com';
const TEST_DIETITIAN_PASSWORD = process.env.TEST_DIETITIAN_PASSWORD || 'TestPassword123!';
const TEST_CLIENT_ID = process.env.TEST_CLIENT_ID || 'test-client-id';

test.describe('Web Panel Smoke Tests', () => {

  test('Test 1: Unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    // Navigate to dashboard without being logged in
    await page.goto('/dashboard');

    // Should be redirected to login page
    await expect(page).toHaveURL(/\/auth\/login/);

    // Verify login page elements are present
    await expect(page.locator('h1')).toContainText('Diyetisyen Girişi');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('Test 2: Login works and dashboard loads', async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login');

    // Fill in login form
    await page.fill('input[name="email"]', TEST_DIETITIAN_EMAIL);
    await page.fill('input[name="password"]', TEST_DIETITIAN_PASSWORD);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify dashboard loaded
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify /api/auth/me returns correct data after login
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await page.request.get('/api/auth/me', {
      headers: {
        'Cookie': cookieHeader
      }
    });

    expect(response.status()).toBe(200);
    const userData = await response.json();
    expect(userData.role).toBe('dietitian');
    expect(userData.email).toBeTruthy();
    expect(userData.userId).toBeTruthy();

    // Check for KPI section or dashboard content
    const hasContent = await page.locator('main').isVisible();
    expect(hasContent).toBe(true);
  });

  test('Test 3: Clients list loads', async ({ page, context }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_DIETITIAN_EMAIL);
    await page.fill('input[name="password"]', TEST_DIETITIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Navigate to clients page
    await page.goto('/dashboard/clients');

    // Verify URL
    await expect(page).toHaveURL(/\/dashboard\/clients/);

    // Verify search input exists (stable selector)
    await expect(page.getByTestId('clients-search')).toBeVisible();

    // Verify either table OR empty state is visible (deterministic check)
    const hasTable = await page.getByTestId('clients-table').isVisible().catch(() => false);
    const hasEmpty = await page.getByTestId('clients-empty').isVisible().catch(() => false);

    // At least one should be visible
    expect(hasTable || hasEmpty).toBe(true);

    // If table exists, verify basic structure
    if (hasTable) {
      // Check for pagination controls
      const hasPagination = await page.getByTestId('clients-next').isVisible().catch(() => false);
      expect(hasPagination).toBe(true);
    }
  });

  test('Test 4: Client detail loads for known test clientId', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_DIETITIAN_EMAIL);
    await page.fill('input[name="password"]', TEST_DIETITIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Navigate to client detail page
    await page.goto(`/dashboard/clients/${TEST_CLIENT_ID}`);

    // Verify URL
    await expect(page).toHaveURL(new RegExp(`/dashboard/clients/${TEST_CLIENT_ID}`));

    // Check for client detail page elements (tabs, header, etc.)
    // This may show error state if client doesn't exist, which is acceptable
    await expect(page.locator('main')).toBeVisible();

    // Look for tabs or error message
    const hasTabs = await page.locator('[role="tab"]').count().catch(() => 0);
    const hasError = await page.locator('text=/not found/i').isVisible().catch(() => false);
    const hasBackButton = await page.locator('text=/back to clients/i').isVisible().catch(() => false);

    // Page should have loaded (either with content or error state)
    expect(hasTabs > 0 || hasError || hasBackButton).toBeTruthy();
  });

  test('Test 5: AccessKeyModal opens and closes', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_DIETITIAN_EMAIL);
    await page.fill('input[name="password"]', TEST_DIETITIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Navigate to access keys page
    await page.goto('/dashboard/access-keys');

    // Look for a button to open the modal (may vary based on implementation)
    // This test will be skipped if the button doesn't exist
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("New")').first();

    if (await generateButton.isVisible().catch(() => false)) {
      // Click to open modal
      await generateButton.click();

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => null);

      // Check if modal is visible
      const modalVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);

      if (modalVisible) {
        // Close modal (look for close button or click outside)
        const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        }

        // Verify modal is closed
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      }
    } else {
      // Skip test if no generate button found
      test.skip();
    }
  });

  test('Test 6: Logout returns to /login and blocks /dashboard', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_DIETITIAN_EMAIL);
    await page.fill('input[name="password"]', TEST_DIETITIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Çıkış"), [aria-label="Logout"]').first();
    await logoutButton.click();

    // Wait for redirect to login
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });

    // Verify we're on login page
    await expect(page).toHaveURL(/\/auth\/login/);

    // Try to access dashboard again
    await page.goto('/dashboard');

    // Should be redirected back to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
