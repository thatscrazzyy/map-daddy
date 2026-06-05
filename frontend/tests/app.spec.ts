import { test, expect } from '@playwright/test';

test.describe('Map Daddy Browser Projection MVP', () => {
  test('dashboard loads and can create a project', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('MAP DADDY')).toBeVisible();
    await expect(page.getByText('v0.1.0')).toBeVisible();
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

  test('editor exposes surface alignment and crop controls', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Create and Open/i }).click();
    await page.getByRole('button', { name: /Add/i }).click();

    await expect(page.getByText('Source Crop')).toBeVisible();
    await expect(page.getByRole('button', { name: /Center/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Fit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Forward/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Backward/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Snap/i })).toBeVisible();
  });

  test('editor exposes video playback controls for video media', async ({ page }) => {
    const projectId = `project_video_${Date.now()}`;
    await page.addInitScript((id) => {
      const project = {
        id,
        name: 'Video Controls Test',
        canvas: {
          width: 1920,
          height: 1080,
          backgroundColor: '#000000'
        },
        media: [{
          id: 'media_video',
          type: 'video',
          url: 'about:blank',
          name: 'clip.mp4',
          videoSettings: {
            loop: true,
            muted: true,
            playbackRate: 1,
            startTime: 0
          }
        }],
        surfaces: [{
          id: 'surface_video',
          name: 'Video Surface',
          mediaId: 'media_video',
          visible: true,
          opacity: 1,
          blendMode: 'source-over',
          sourceRect: { x: 0, y: 0, width: 1920, height: 1080 },
          destinationQuad: [
            { x: 480, y: 270 },
            { x: 1440, y: 270 },
            { x: 1440, y: 810 },
            { x: 480, y: 810 }
          ],
          updatedAt: new Date().toISOString()
        }],
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(`map-daddy.project.${id}`, JSON.stringify(project));
      localStorage.setItem('map-daddy.projects', JSON.stringify([id]));
    }, projectId);

    await page.goto(`/editor/${projectId}`);

    await expect(page.getByText('Video Playback')).toBeVisible();
    await expect(page.getByLabel('Loop')).toBeChecked();
    await expect(page.getByLabel('Muted')).toBeChecked();
    await expect(page.getByLabel('Playback Speed')).toHaveValue('1');
    await expect(page.getByLabel('Start Time (seconds)')).toHaveValue('0');
  });

  test('dashboard can rename and delete a project', async ({ page }) => {
    const originalName = `Project CRUD ${Date.now()}`;
    const renamedName = `${originalName} Renamed`;
    await page.goto('/dashboard');
    await page.locator('input').fill(originalName);
    await page.getByRole('button', { name: /Create and Open/i }).click();
    await expect(page).toHaveURL(/\/editor\/project_/);

    await page.goto('/dashboard');
    const card = page.locator('article').filter({ hasText: originalName });
    await expect(card).toHaveCount(1);
    await card.getByTitle('Rename project').click();
    await page.locator('article input').fill(renamedName);
    await page.locator('article').filter({ has: page.locator('input') }).getByTitle('Save project name').click();
    await expect(page.locator('article').filter({ hasText: renamedName })).toHaveCount(1);

    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('article').filter({ hasText: renamedName }).getByTitle('Delete project').click();
    await expect(page.locator('article').filter({ hasText: renamedName })).toHaveCount(0);
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
