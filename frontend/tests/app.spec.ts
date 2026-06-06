import { test, expect, type BrowserContext, type Page } from '@playwright/test';

async function forceLocalOnly(context: BrowserContext) {
  await context.route('**/api/**', route => route.abort());
  await context.route('**/media/**', route => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('md_api_url', 'http://127.0.0.1:9');
    localStorage.setItem('md_relay_url', 'ws://127.0.0.1:9');
  });
}

function mediaPanel(page: Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Media' }) });
}

async function createProject(page: Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Create and Open/i }).click();
  await expect(page).toHaveURL(/\/editor\/(.+)/);
  return page.url().split('/editor/')[1];
}

async function addSample(page: Page) {
  await page.getByRole('button', { name: /Sample/i }).click();
  await expect(mediaPanel(page).getByText(/map-daddy-sample-.*\.png/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Surface 1/i })).toBeVisible();
  await expect(page.getByText('Saved')).toBeVisible();
}

async function canvasDataUrl(page: Page) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}

async function expectLocalSamplePersisted(page: Page, projectId: string) {
  await expect.poll(
    () => page.evaluate(async (id) => {
      const raw = localStorage.getItem(`map-daddy.project.${id}`);
      if (!raw) return false;
      const project = JSON.parse(raw);
      const media = project.media?.[0];
      if (
        project.media?.length !== 1 ||
        project.surfaces?.length !== 1 ||
        !media?.id?.startsWith('local_media_') ||
        !media?.url?.startsWith('local://') ||
        !/^map-daddy-sample-.*\.png$/.test(media.name || '')
      ) {
        return false;
      }

      const request = indexedDB.open('map-daddy-media', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction('media-blobs', 'readonly');
        const getRequest = tx.objectStore('media-blobs').get(media.id);
        getRequest.onsuccess = () => resolve(((getRequest.result as Blob | undefined)?.size || 0) > 0);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => db.close();
      });
    }, projectId),
    { message: 'sample image is stored as a local project entry and IndexedDB blob' }
  ).toBe(true);
}

test.beforeEach(async ({ context }) => {
  await forceLocalOnly(context);
});

test.describe('Map Daddy Browser Projection MVP', () => {
  test('dashboard loads and can create a project', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('MAP DADDY')).toBeVisible();
    await expect(page.getByText('v0.2.0')).toBeVisible();
    await expect(page.getByText('Create Project')).toBeVisible();

    await page.getByRole('button', { name: /Create and Open/i }).click();
    await expect(page).toHaveURL(/\/editor\/project_/);
    await expect(page.getByText('Editor Canvas')).toBeVisible();
  });

  test('editor can create a surface', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: /Add/i }).click();

    await expect(page.getByRole('button', { name: /Surface 1/i })).toBeVisible();
    await expect(page.getByText('Opacity')).toBeVisible();
  });

  test('editor exposes surface tools and source crop controls', async ({ page }) => {
    await createProject(page);
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
    const projectId = await createProject(page);
    await page.getByRole('button', { name: /Add/i }).click();

    const projector = await context.newPage();
    await projector.goto(`/projector/${projectId}`);
    await expect(projector.getByText(/connected|connecting|reconnecting|offline|local|synced/i)).toBeVisible();
    await expect(projector.locator('canvas')).toBeVisible();
  });
});

test.describe('Map Daddy v0.2.0 Local First', () => {
  test('first-run checklist appears for blank project and disappears when populated', async ({ page }) => {
    await createProject(page);

    await expect(page.getByText('Getting Started')).toBeVisible();
    await expect(page.getByText('Upload media or add sample')).toBeVisible();

    await addSample(page);

    await expect(page.getByText('Getting Started')).not.toBeVisible();
  });

  test('local image sample persists after editor refresh', async ({ page }) => {
    const projectId = await createProject(page);
    await addSample(page);
    await expectLocalSamplePersisted(page, projectId);

    await page.reload();

    await expect(mediaPanel(page).getByText(/map-daddy-sample-.*\.png/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Surface 1/i })).toBeVisible();
    await expectLocalSamplePersisted(page, projectId);
  });

  test('local image sample renders in projector after editor refresh', async ({ page, context }) => {
    const projectId = await createProject(page);
    await addSample(page);

    await page.reload();
    await expect(mediaPanel(page).getByText(/map-daddy-sample-.*\.png/)).toBeVisible();

    const projector = await context.newPage();
    await projector.goto(`/projector/${projectId}`);
    await expect(projector.locator('canvas')).toBeVisible();
    await expect.poll(async () => (await canvasDataUrl(projector)).length).toBeGreaterThan(5000);

    await projector.reload();
    await expect(projector.locator('canvas')).toBeVisible();
    await expect.poll(async () => (await canvasDataUrl(projector)).length).toBeGreaterThan(5000);
  });

  test('same-browser projector updates from editor without relay', async ({ page, context }) => {
    const projectId = await createProject(page);
    await addSample(page);

    const projector = await context.newPage();
    await projector.goto(`/projector/${projectId}`);
    await expect(projector.locator('canvas')).toBeVisible();
    await expect.poll(async () => (await canvasDataUrl(projector)).length).toBeGreaterThan(5000);

    const before = await canvasDataUrl(projector);
    await page.keyboard.press('ArrowRight');

    await expect.poll(async () => canvasDataUrl(projector)).not.toBe(before);
  });

  test('project editing remains possible with no projector connected', async ({ page }) => {
    const projectId = await createProject(page);
    await addSample(page);

    await expect(page.getByText(/No projector connected|Local projector connected|Synced/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Surface 1/i })).toBeVisible();
    await page.getByLabel('Name').fill('Lobby Wall');
    await expect.poll(
      () => page.evaluate((id) => {
        const raw = localStorage.getItem(`map-daddy.project.${id}`);
        return raw ? JSON.parse(raw).surfaces?.[0]?.name : '';
      }, projectId),
      { message: 'surface edit is saved locally without a projector tab' }
    ).toBe('Lobby Wall');

    await page.reload();
    await expect(page.getByRole('button', { name: /Lobby Wall/i })).toBeVisible();
    await expect.poll(
      () => page.evaluate((id) => {
        const raw = localStorage.getItem(`map-daddy.project.${id}`);
        return raw ? JSON.parse(raw).surfaces?.[0]?.name : '';
      }, projectId),
      { message: 'surface edit is saved locally without a projector tab' }
    ).toBe('Lobby Wall');
  });

  test('video uploads show session-only local warning', async ({ page }) => {
    await createProject(page);

    await page.getByLabel('Upload').setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video')
    });

    await expect(mediaPanel(page).getByText('clip.mp4')).toBeVisible();
    await expect(page.getByText(/session-only/i)).toBeVisible();
    await expect(page.getByText('Video Playback')).toBeVisible();
    await expect(page.getByLabel('Loop')).toBeChecked();
    await expect(page.getByLabel('Muted')).toBeChecked();
    await expect(page.getByLabel('Playback Speed')).toHaveValue('1');
    await expect(page.getByLabel('Start Time (seconds)')).toHaveValue('0');
  });
});
