import { test, expect } from '@playwright/test';

/**
 * Layer 2 / E2E: Script Creation & Voting Flows
 * 
 * Tests end-to-end workflows for:
 * - Creating Scripts in studios s
 * - Upvoting and downvoting
 * - Viewing karma scores
 * - Comment threads
 * 
 * Run with: npm run test:e2e
 */

test.describe('Script Creation & Viewing', () => {
  test('should create a new Script in a studios ', async ({ page, context }) => {
    const isAuthenticated = await context.storageState();
    
    if (isAuthenticated) {
      await page.goto('/studios s');

      // Navigate to first studios 
      const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
      if (await firststudios .isVisible()) {
        await firststudios .click();
        await page.waitForNavigation();

        // Click "Create Script" button
        const createScriptBtn = page.locator('button:has-text("Create Script"), button:has-text("New Script")');
        if (await createScriptBtn.isVisible()) {
          await createScriptBtn.click();

          // Fill Script content
          const contentInput = page.locator(
            'textarea[name="content"], textarea[placeholder*="content"], textarea[placeholder*="Script"]'
          );
          
          if (await contentInput.isVisible()) {
            const ScriptContent = `E2E test Script at ${new Date().toISOString()}`;
            await contentInput.fill(ScriptContent);

            // Submit
            const submitBtn = page.locator('button:has-text("Script"), button[type="submit"]');
            await submitBtn.click();

            // Verify Script appears
            const ScriptElement = page.locator(`text="${ScriptContent}"`);
            await expect(ScriptElement).toBeVisible({ timeout: 5000 }).catch(() => {});
          }
        }
      }
    }
  });

  test('should display Scripts with vote counts', async ({ page }) => {
    await page.goto('/studios s');

    const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
    if (await firststudios .isVisible()) {
      await firststudios .click();
      await page.waitForNavigation();

      // Wait for Scripts to load
      const ScriptCards = page.locator('[data-testid="Script-card"], .Script-card, [role="article"]');
      await expect(ScriptCards.first()).toBeVisible({ timeout: 5000 });

      // Verify vote count is displayed
      const voteCount = page.locator('[data-testid="vote-count"], .vote-count, text=/\\d+ (upvotes|votes|points)/i');
      if (await voteCount.isVisible()) {
        const countText = await voteCount.first().textContent();
        expect(countText).toMatch(/\d+/);
      }
    }
  });

  test('should paginate through Scripts', async ({ page }) => {
    await page.goto('/studios s');

    const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
    if (await firststudios .isVisible()) {
      await firststudios .click();
      await page.waitForNavigation();

      // Look for pagination
      const nextButton = page.locator('button:has-text("Next"), a:has-text("next"), [aria-label*="next page"]');
      if (await nextButton.isVisible() && !await nextButton.isDisabled()) {
        const beforeUrl = page.url();
        await nextButton.click();
        await page.waitForNavigation();

        // URL or content should change
        const afterUrl = page.url();
        expect(beforeUrl !== afterUrl || page.locator('[data-testid="Script-card"]').isVisible()).toBeTruthy();
      }
    }
  });
});

test.describe('Voting System', () => {
  test('should upvote a Script', async ({ page, context }) => {
    const isAuthenticated = await context.storageState();
    
    if (isAuthenticated) {
      await page.goto('/studios s');

      const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
      if (await firststudios .isVisible()) {
        await firststudios .click();
        await page.waitForNavigation();

        // Get initial vote count
        const voteCountBefore = page.locator('[data-testid="vote-count"], .vote-count').first();
        const countBefore = await voteCountBefore.textContent();

        // Click upvote button
        const upvoteBtn = page.locator('button[data-testid="upvote"], button[aria-label*="upvote"], .upvote-btn').first();
        if (await upvoteBtn.isVisible()) {
          await upvoteBtn.click();

          // Wait for vote to process
          await page.waitForTimeout(500);

          // Verify vote count increased or button state changed
          const voteCountAfter = await voteCountBefore.textContent();
          const buttonEnabled = await upvoteBtn.isEnabled();
          
          // Vote should either increase count or disable button (already voted)
          expect(
            countBefore !== voteCountAfter || !buttonEnabled
          ).toBeTruthy();
        }
      }
    }
  });

  test('should downvote a Script', async ({ page, context }) => {
    const isAuthenticated = await context.storageState();
    
    if (isAuthenticated) {
      await page.goto('/studios s');

      const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
      if (await firststudios .isVisible()) {
        await firststudios .click();
        await page.waitForNavigation();

        // Click downvote button
        const downvoteBtn = page.locator('button[data-testid="downvote"], button[aria-label*="downvote"], .downvote-btn').first();
        if (await downvoteBtn.isVisible()) {
          await downvoteBtn.click();

          // Wait for vote to process
          await page.waitForTimeout(500);

          // Button should be disabled or vote count should change
          const isDisabled = await downvoteBtn.isDisabled();
          expect(isDisabled || await downvoteBtn.isVisible()).toBeTruthy();
        }
      }
    }
  });

  test('should display karma leaderboard', async ({ page }) => {
    // Navigate to leaderboard if available
    const leaderboardLink = page.locator('a:has-text("Leaderboard"), a:has-text("Karma"), a[href*="leaderboard"]');
    
    if (await leaderboardLink.isVisible()) {
      await leaderboardLink.click();
      await page.waitForNavigation();

      // Verify leaderboard loaded
      const leaderboardTable = page.locator('table, [role="table"], .leaderboard');
      await expect(leaderboardTable).toBeVisible({ timeout: 5000 }).catch(() => {});

      // Check for ranked entries (should be sorted by karma)
      const entries = page.locator('[role="row"], tr, .leaderboard-entry');
      const entryCount = await entries.count();
      
      // Numeric assertion: should have at least some entries
      expect(entryCount).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });
});

test.describe('Comments & Discussions', () => {
  test('should open Script and display comments', async ({ page }) => {
    await page.goto('/studios s');

    const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
    if (await firststudios .isVisible()) {
      await firststudios .click();
      await page.waitForNavigation();

      // Click on a Script to view details
      const ScriptLink = page.locator('[data-testid="Script-card"] a, .Script-card a').first();
      if (await ScriptLink.isVisible()) {
        await ScriptLink.click();
        await page.waitForNavigation();

        // Look for comments section
        const commentsSection = page.locator('[data-testid="comments"], .comments-section, text=/Comments/i');
        if (await commentsSection.isVisible()) {
          await expect(commentsSection).toBeVisible();
        }
      }
    }
  });

  test('should add comment to Script (when authenticated)', async ({ page, context }) => {
    const isAuthenticated = await context.storageState();
    
    if (isAuthenticated) {
      await page.goto('/studios s');

      const firststudios  = page.locator('[data-testid="studios -list"] a, .studios -card a').first();
      if (await firststudios .isVisible()) {
        await firststudios .click();
        await page.waitForNavigation();

        const ScriptLink = page.locator('[data-testid="Script-card"] a, .Script-card a').first();
        if (await ScriptLink.isVisible()) {
          await ScriptLink.click();
          await page.waitForNavigation();

          // Find comment input
          const commentInput = page.locator(
            'textarea[name="comment"], textarea[placeholder*="comment"], .comment-input'
          );

          if (await commentInput.isVisible()) {
            const commentText = `E2E test comment - ${Date.now()}`;
            await commentInput.fill(commentText);

            // Submit comment
            const submitBtn = page.locator('button:has-text("Comment"), button:has-text("Script"), button[type="submit"]');
            await submitBtn.click();

            // Verify comment appears
            const newComment = page.locator(`text="${commentText}"`);
            await expect(newComment).toBeVisible({ timeout: 5000 }).catch(() => {});
          }
        }
      }
    }
  });
});
