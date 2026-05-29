import { test, expect } from '@playwright/test';

test.describe('Map Daddy Browser Projection MVP', () => {
  test('dashboard loads and can create a project', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('MAP DADDY')).toBeVisible();
    await expect(page.getByText('Create Project')).toBeVisible();

    await page.getByRole('button', { name: /Create and Open/i }).click();
    await expect(page).toHaveURL(/\/editor\/project_/);
    await expect(page.getByText('Editor Canvas')).toBeVisible();
  });

  test('editor can create a surface', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Create and Open/i }).click();
    await page.getByRole('button', { name: /Add/i }).click();

    await expect(page.getByRole('button', { name: /Surface 1/i })).toBeVisible();
    await expect(page.getByText('Opacity')).toBeVisible();
  });

  test('projector route loads latest saved project', async ({ page, context }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Create and Open/i }).click();
    await page.getByRole('button', { name: /Add/i }).click();
    await expect(page).toHaveURL(/\/editor\/(.+)/);
    const projectId = page.url().split('/editor/')[1];

    const projector = await context.newPage();
    await projector.goto(`/projector/${projectId}`);
    await expect(projector.getByText(/connected|connecting|reconnecting|offline/i)).toBeVisible();
    await expect(projector.locator('canvas')).toBeVisible();
  });
});
