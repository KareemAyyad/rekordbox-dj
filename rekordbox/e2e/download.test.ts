import { test, expect } from '@playwright/test';

test.describe('Hoover E2E Download Test', () => {
  test('should classify and download a YouTube link', async ({ page }) => {
    // Set a longer timeout for this test because it involves actual downloading
    test.setTimeout(120000);

    await page.goto('/');

    const youtubeUrl = 'https://www.youtube.com/watch?v=5vheNbQvFpg'; // Afro House track
    
    // Paste the URL
    const textArea = page.locator('textarea[placeholder="Paste links here..."]');
    await textArea.fill(youtubeUrl);

    // Click Add
    await page.click('button:has-text("Add")');

    // Verify it was added to the queue
    await expect(page.locator(`text=${youtubeUrl}`)).toBeVisible();

    // Wait for auto-classification to finish (it starts automatically)
    // We look for the confidence score or the genre badge
    await expect(page.locator('text=% confidence')).toBeVisible({ timeout: 60000 });

    // Click Start to begin download
    await page.click('button:has-text("Start")');

    // Verify it moves to "processing" or shows a stage
    await expect(page.locator('text=Stage:')).toBeVisible({ timeout: 10000 });

    // Wait for completion
    await expect(page.locator('text=Completed: 1 successful')).toBeVisible({ timeout: 90000 });
    
    // Navigate to Library to see the downloaded track
    await page.click('button:has-text("Library")');
    await expect(page.locator('text=Afro House')).toBeVisible();
  });
});
