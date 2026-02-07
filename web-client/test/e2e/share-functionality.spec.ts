/// <reference types="node" />
import { test, expect } from '@playwright/test';

/**
 * Layer 2 / E2E: Share Functionality Tests
 *
 * These tests exercise complete user workflows end-to-end:
 * - Share button visibility
 * - Click interactions
 * - Clipboard operations
 * - Toast notifications
 * - Analytics tracking
 * - URL validation
 *
 * Run with: npm run test:e2e -- share-functionality.spec.ts
 */

test.describe('Share Functionality E2E', () => {
  test('should show share button on script cards in feed', async ({ page }) => {
    await page.goto('/');

    // Wait for scripts to load
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Find share buttons
    const shareButtons = page.locator('button:has-text("Share")');
    const count = await shareButtons.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should show share button on script detail page', async ({ page }) => {
    await page.goto('/');

    // Wait for scripts to load
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Click on the first script to view details
    const firstScript = page.locator('[class*="Script-card"]').first();
    const firstLink = firstScript.locator('a').first();

    await firstLink.click();

    // Wait for detail page to load
    await page.waitForURL(/\/post\/[^/]+/, { timeout: 10000 });

    // Verify share button exists on detail page
    const shareButton = page.locator('button:has-text("Share")');
    await expect(shareButton).toBeVisible({ timeout: 5000 });
  });

  test('should copy link to clipboard on desktop', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Click first share button
    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();

    // Verify toast notification appears
    const toastSelector = '[role="status"], [class*="toast"], text=/copied to clipboard/i';
    await expect(page.locator(toastSelector).first()).toBeVisible({ timeout: 3000 });

    // Verify URL was copied to clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('moltmotionpictures.com/post/');
    expect(clipboardText).toMatch(/^https?:\/\//); // Should be a valid URL
  });

  test('should verify shared URL is valid and accessible', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Click share button
    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();

    // Wait for share operation to complete
    await page.waitForTimeout(500);

    // Get copied URL from clipboard
    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedUrl).toBeTruthy();

    // Navigate to the shared URL in a new page
    const newPage = await context.newPage();
    await newPage.goto(copiedUrl, { waitUntil: 'networkidle' });

    // Verify the page loads successfully
    await expect(newPage.locator('main, [role="main"]')).toBeVisible({ timeout: 10000 });

    // Verify it's a script detail page
    expect(newPage.url()).toContain('/post/');

    // Verify share button exists on the shared page too
    await expect(newPage.locator('button:has-text("Share")').first()).toBeVisible();

    await newPage.close();
  });

  test('should track analytics event when sharing', async ({ page }) => {
    // Mock PostHog to capture events
    await page.addInitScript(() => {
      (window as any).__shareEvents = [];
      (window as any).posthog = {
        capture: (event: string, props: any) => {
          (window as any).__shareEvents.push({ event, props });
        },
        init: () => {},
        // Add other PostHog methods that might be called
        identify: () => {},
        reset: () => {}
      };
    });

    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Click share button
    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();

    // Wait for share operation and analytics
    await page.waitForTimeout(1000);

    // Check that analytics event was fired
    const events = await page.evaluate(() => (window as any).__shareEvents);
    const shareEvent = events.find((e: any) => e.event === 'script_shared');

    expect(shareEvent).toBeDefined();
    expect(shareEvent.props).toHaveProperty('script_id');
    expect(shareEvent.props).toHaveProperty('share_method');
    expect(shareEvent.props.share_method).toMatch(/native|clipboard/);
  });

  test('should handle mobile viewport and show share button', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Verify share button is visible on mobile
    const shareButton = page.locator('button:has-text("Share")').first();
    await expect(shareButton).toBeVisible({ timeout: 5000 });

    // Button should be clickable
    await expect(shareButton).toBeEnabled();

    // Click should not crash the page
    await shareButton.click();

    // Should either open native share or show toast
    const hasToast = (await page.locator('[role="status"], [class*="toast"]').count()) > 0;
    expect(hasToast).toBeTruthy();
  });

  test('should handle share button in script list', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Get the second script card to test different scripts
    const secondShareButton = page.locator('button:has-text("Share")').nth(1);
    await secondShareButton.click();

    // Toast should appear
    await expect(page.locator('text=/copied/i').first()).toBeVisible({ timeout: 3000 });

    // Each script should have a unique URL
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/\/post\/[a-zA-Z0-9_-]+/);
  });

  test('should handle rapid consecutive shares', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    const shareButton = page.locator('button:has-text("Share")').first();

    // Click share button multiple times rapidly
    await shareButton.click();
    await shareButton.click();
    await shareButton.click();

    // Wait for operations to complete
    await page.waitForTimeout(1000);

    // Page should still be functional
    await expect(page.locator('main')).toBeVisible();

    // Should still have clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/post/');
  });

  test('should preserve page state after sharing', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Get initial page state
    const initialUrl = page.url();
    const scriptCount = await page.locator('[class*="Script-card"]').count();

    // Click share button
    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();

    await page.waitForTimeout(500);

    // Verify page state is unchanged
    expect(page.url()).toBe(initialUrl);
    const newScriptCount = await page.locator('[class*="Script-card"]').count();
    expect(newScriptCount).toBe(scriptCount);
  });

  test('should work when navigating between pages', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Start on home page
    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    // Share from home
    await page.locator('button:has-text("Share")').first().click();
    await page.waitForTimeout(300);

    const homeUrl = await page.evaluate(() => navigator.clipboard.readText());

    // Navigate to the script detail page
    await page.goto(homeUrl);
    await page.waitForSelector('button:has-text("Share")', { timeout: 10000 });

    // Share from detail page
    await page.locator('button:has-text("Share")').first().click();
    await page.waitForTimeout(300);

    const detailUrl = await page.evaluate(() => navigator.clipboard.readText());

    // Both should be valid URLs
    expect(homeUrl).toContain('/post/');
    expect(detailUrl).toContain('/post/');
    expect(homeUrl).toBe(detailUrl); // Should be the same script
  });

  test('should display appropriate error handling', async ({ page, context }) => {
    // Don't grant clipboard permissions to test error path
    await context.clearPermissions();

    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();

    // Might show error toast or handle gracefully
    // Page should not crash
    await expect(page.locator('main')).toBeVisible();

    // Share button should still be present and clickable
    await expect(shareButton).toBeVisible();
  });

  test('should have accessible share buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[class*="Script-card"]', { timeout: 10000 });

    const shareButtons = page.locator('button:has-text("Share")');

    // All share buttons should be accessible
    const count = await shareButtons.count();
    for (let i = 0; i < Math.min(count, 3); i++) { // Test first 3
      const button = shareButtons.nth(i);
      await expect(button).toBeEnabled();

      // Should have proper role
      const role = await button.getAttribute('role');
      expect(role === null || role === 'button').toBe(true);
    }
  });
});
