import { test, expect } from '@playwright/test';

test.describe('Map Daddy Frontend E2E', () => {
  test('App loads successfully and shows dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page.locator('text=MAP DADDY v0.3')).toBeVisible();
    
    // Check dashboard text
    await expect(page.locator('text=Project Dashboard')).toBeVisible();
  });

  test('Start Projection Session handles empty backend/relay gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Click Start Session
    const startButton = page.locator('button', { hasText: 'Start Session' });
    await startButton.click();
    
    // It should eventually show a session error or become a session
    // Depending on backend connection (in CI without backend it shows error)
    await page.waitForTimeout(1000);
    const sessionError = page.locator('text=Could not start a projection session');
    const sessionStarted = page.locator('text=Live Status');
    
    const hasError = await sessionError.isVisible();
    const hasStarted = await sessionStarted.isVisible();
    
    expect(hasError || hasStarted).toBeTruthy();
  });

  test('Navigation to Workspace and Settings', async ({ page }) => {
    await page.goto('/');
    
    // Go to Workspace
    await page.locator('nav').locator('text=Workspace').click();
    await expect(page.locator('text=Project:')).toBeVisible();
    await expect(page.locator('text=Source / Input')).toBeVisible();
    await expect(page.locator('text=Destination / Output')).toBeVisible();

    // Go to Library
    await page.locator('nav').locator('text=Library').click();
    await expect(page.locator('text=Asset Library')).toBeVisible();

    // Go to Settings
    await page.locator('nav').locator('text=Settings').click();
    await expect(page.locator('text=Output Settings')).toBeVisible();
  });

  test('Create a mapping', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('nav').locator('text=Workspace').click();
    
    // The layers list should initially show at least one default layer or be empty
    const addQuadBtn = page.locator('button[title="Add quad"]');
    if (await addQuadBtn.isVisible()) {
      await addQuadBtn.click();
      
      // Wait for it to appear
      await page.waitForTimeout(500);
      
      // We expect a new layer "Quad Mapping" or "Surface"
      // Looking for the properties panel which only shows when a layer is selected
      await expect(page.locator('text=Properties Inspector')).toBeVisible();
      const opacLabel = page.locator('label:has-text("Opacity")');
      await expect(opacLabel).toBeVisible();
    }
  });
});
