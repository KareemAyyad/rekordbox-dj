import { test, expect } from '@playwright/test';

test.describe('Hoover E2E Smoke Test', () => {
  test('should load the app and navigate tabs', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page.locator('text=Hoover')).toBeVisible();

    // Default tab should be Queue
    await expect(page.locator('button:has-text("Queue")')).toHaveClass(/bg-\[var\(--dc-chip-strong\)\]/);

    // Navigate to Library
    await page.click('button:has-text("Library")');
    await expect(page.locator('button:has-text("Library")')).toHaveClass(/bg-\[var\(--dc-chip-strong\)\]/);

    // Navigate to Settings
    await page.click('button:has-text("Settings")');
    await expect(page.locator('button:has-text("Settings")')).toHaveClass(/bg-\[var\(--dc-chip-strong\)\]/);
  });

  test('should toggle theme', async ({ page }) => {
    await page.goto('/');

    const themeButton = page.locator('button[title="Toggle theme"]');
    const initialText = await themeButton.innerText();
    
    await themeButton.click();
    const newText = await themeButton.innerText();
    
    expect(initialText).not.toBe(newText);
  });

  test('should show help overlay', async ({ page }) => {
    await page.goto('/');

    await page.click('button:has-text("Help Off")');
    await expect(page.locator('text=Shortcuts')).toBeVisible();
    
    await page.click('button:has-text("Help On")');
    await expect(page.locator('text=Shortcuts')).not.toBeVisible();
  });
});
