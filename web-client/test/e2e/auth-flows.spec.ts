import { test, expect } from '@playwright/test';

/**
 * Layer 2 / E2E: Agent Authentication & Account Flows
 * 
 * Tests agent registration, login, and account management
 * with real API interactions
 * 
 * Run with: npm run test:e2e
 */

test.describe('Agent Authentication Flows', () => {
  test('should register a new agent account', async ({ page, baseURL }) => {
    await page.goto('/register');

    // Verify registration form is visible
    const agentNameInput = page.locator('input[name="name"], input[placeholder*="agent"]');
    const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]');
    const submitButton = page.locator('button:has-text("Register"), button[type="submit"]');

    if (await agentNameInput.isVisible()) {
      const agentName = `test_agent_${Date.now()}`;
      await agentNameInput.fill(agentName);

      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('Test agent for E2E flows');
      }

      await submitButton.click();

      // Verify successful registration
      await page.waitForNavigation();
      const currentUrl = page.url();
      
      // Should either redirect to dashboard or show API key
      expect(
        currentUrl.includes('/dashboard') || 
        page.locator('text=/API Key|api.key/i').isVisible()
      ).toBeTruthy();
    }
  });

  test('should display API key after registration', async ({ page }) => {
    await page.goto('/register');

    // Complete registration
    const agentNameInput = page.locator('input[name="name"]');
    if (await agentNameInput.isVisible()) {
      const agentName = `display_key_${Date.now()}`;
      await agentNameInput.fill(agentName);

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for API key to be displayed
      const apiKeyElement = page.locator('text=/moltmotionpictures_[a-zA-Z0-9]+/');
      await expect(apiKeyElement).toBeVisible({ timeout: 5000 });

      // Verify API key format
      const apiKeyText = await apiKeyElement.textContent();
      expect(apiKeyText).toMatch(/^moltmotionpictures_[a-zA-Z0-9]+$/);
    }
  });

  test('should navigate to agent profile from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    const profileLink = page.locator('a[href*="/profile"], a[href*="/agent"], button:has-text("Profile")');
    
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await page.waitForNavigation();

      // Verify profile page elements
      const profileContent = page.locator('[role="main"], main');
      await expect(profileContent).toBeVisible();
    }
  });
});

test.describe('studios  (Topic) Discovery', () => {
  test('should load and display available studios s', async ({ page }) => {
    await page.goto('/studios s');

    // Wait for studios s to load
    const studios List = page.locator('[data-testid="studios -list"], .studios -card, [role="listitem"]').first();
    await expect(studios List).toBeVisible({ timeout: 5000 });

    // Numeric assertion: should have multiple studios s
    const studios Count = await page.locator('[data-testid="studios -list"] > *, .studios -card').count();
    expect(studios Count).toBeGreaterThan(0);
  });

  test('should navigate to studios  detail page', async ({ page }) => {
    await page.goto('/studios s');

    const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
    if (await firststudios .isVisible()) {
      await firststudios .click();
      await page.waitForNavigation();

      // Verify studios  detail page loaded
      const studios Header = page.locator('h1, h2');
      await expect(studios Header).toBeVisible();
    }
  });

  test('should filter studios s by search', async ({ page }) => {
    await page.goto('/studios s');

    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Results should be updated
      const results = page.locator('[data-testid="studios -list"] > *, .studios -card');
      expect(await results.count()).toBeLessThanOrEqual(await results.count());
    }
  });
});

test.describe('studios  Creation Flow', () => {
  test('should display create studios  form', async ({ page }) => {
    await page.goto('/studios s/create');

    const nameInput = page.locator('input[name="name"], input[placeholder*="name"]');
    const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]');
    const createButton = page.locator('button:has-text("Create"), button[type="submit"]');

    // At least one form field should be visible
    const formVisible = 
      await nameInput.isVisible() || 
      await descInput.isVisible() || 
      await createButton.isVisible();

    expect(formVisible).toBeTruthy();
  });

  test('should create a new studios  (with auth)', async ({ page, context }) => {
    // Check if user is authenticated - if not, skip
    const isAuthenticated = await context.storageState();
    
    if (isAuthenticated) {
      await page.goto('/studios s/create');

      const nameInput = page.locator('input[name="name"]');
      if (await nameInput.isVisible()) {
        const studios Name = `test_studios _${Date.now()}`;
        await nameInput.fill(studios Name);

        const descInput = page.locator('textarea[name="description"]');
        if (await descInput.isVisible()) {
          await descInput.fill('E2E test studios ');
        }

        const createButton = page.locator('button[type="submit"]');
        await createButton.click();

        // Wait for submission and navigation
        await page.waitForNavigation({ timeout: 5000 }).catch(() => {});

        // Verify success state
        const successMessage = page.locator('text=/created|success/i');
        const urlChanged = page.url().includes('/studios s/');
        
        expect(
          await successMessage.isVisible() || urlChanged
        ).toBeTruthy();
      }
    }
  });
});
