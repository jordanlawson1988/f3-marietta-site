import { test, expect, type Page } from '@playwright/test';

// Admin credentials — set ADMIN_EMAIL + ADMIN_PASSWORD in .env.local to run these tests.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const hasAdminCreds = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

async function loginAdmin(page: Page) {
  await page.goto('/admin');
  await page.waitForSelector('#admin-email', { timeout: 10_000 });
  await page.locator('#admin-email').fill(ADMIN_EMAIL);
  await page.locator('#admin-password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(
    page.locator('nav').getByRole('link', { name: 'Workouts' })
  ).toBeVisible({ timeout: 15_000 });
}

type FakeNewsletter = {
  id: string;
  week_start: string;
  week_end: string;
  title: string | null;
  body_markdown: string | null;
  body_slack_mrkdwn: string | null;
  notes: string | null;
  status: string;
  slack_message_ts: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_edited_by: string | null;
  posted_by: string | null;
};

function makeDraft(overrides: Partial<FakeNewsletter> = {}): FakeNewsletter {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    week_start: '2026-05-11',
    week_end: '2026-05-17',
    title: 'Initial Title',
    body_markdown: '## Initial body',
    body_slack_mrkdwn: '*Initial body*',
    notes: null,
    status: 'draft',
    slack_message_ts: null,
    approved_at: null,
    posted_at: null,
    created_at: '2026-05-13T12:00:00Z',
    updated_at: '2026-05-13T12:00:00Z',
    created_by: 'admin@f3marietta.com',
    last_edited_by: 'admin@f3marietta.com',
    posted_by: null,
    ...overrides,
  };
}

test.describe('Admin Newsletter — List view', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
  });

  test('renders status filters and rows with authorship', async ({ page }) => {
    const draft = makeDraft();
    const posted = makeDraft({
      id: '00000000-0000-0000-0000-000000000002',
      week_start: '2026-05-04',
      week_end: '2026-05-10',
      title: 'Last Week Posted',
      status: 'posted',
      posted_at: '2026-05-10T16:00:00Z',
      posted_by: 'pioneer@f3marietta.com',
    });

    await page.route('**/api/admin/newsletter', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([draft, posted]),
      });
    });

    await page.goto('/admin/newsletter');
    await expect(page.getByRole('heading', { name: 'Newsletter Manager' })).toBeVisible();
    await expect(page.getByRole('button', { name: /All \(2\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Drafts \(1\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Posted \(1\)/i })).toBeVisible();
    await expect(page.getByText('Last Week Posted')).toBeVisible();
    await expect(page.getByText('pioneer@f3marietta.com')).toBeVisible();
  });
});

test.describe('Admin Newsletter — Detail / editor', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
  });

  test('uses live context notes to regenerate the draft body', async ({ page }) => {
    let current = makeDraft();
    let regenerateCalled = false;
    let capturedNotes: string | null = null;

    await page.route(`**/api/admin/newsletter/${current.id}`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(current),
        });
      }
      if (method === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        current = { ...current, ...body };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(current),
        });
      }
      return route.continue();
    });

    await page.route(`**/api/admin/newsletter/${current.id}/regenerate`, async (route) => {
      regenerateCalled = true;
      const payload = JSON.parse(route.request().postData() || '{}');
      capturedNotes = payload.notes ?? null;
      current = {
        ...current,
        title: 'Theme: Mental Toughness',
        body_slack_mrkdwn: '*Regenerated body referencing FNG Pioneer*',
        notes: capturedNotes,
        updated_at: new Date().toISOString(),
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(current),
      });
    });

    await page.goto(`/admin/newsletter/${current.id}`);

    await expect(page.getByRole('heading', { name: 'Newsletter Draft' })).toBeVisible();
    await expect(page.locator('#newsletter-title')).toHaveValue('Initial Title');

    const notesField = page.getByLabel('Live context / notes for AI');
    await expect(notesField).toBeVisible();
    await expect(notesField).toHaveValue('');

    const notesText =
      'Monthly theme: Mental Toughness. New FNG: Pioneer at The Last Stand on Tuesday.';
    await notesField.fill(notesText);

    await page.getByRole('button', { name: /regenerate with notes/i }).click();

    await expect.poll(() => regenerateCalled, { timeout: 5_000 }).toBe(true);
    expect(capturedNotes).toBe(notesText);
    await expect(page.locator('#newsletter-title')).toHaveValue(
      'Theme: Mental Toughness',
      { timeout: 5_000 }
    );
  });

  test('week_start and week_end inputs are editable', async ({ page }) => {
    const current = makeDraft();
    let lastPatchPayload: Record<string, unknown> | null = null;

    await page.route(`**/api/admin/newsletter/${current.id}`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(current),
        });
      }
      if (method === 'PATCH') {
        lastPatchPayload = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...current, ...lastPatchPayload }),
        });
      }
      return route.continue();
    });

    await page.goto(`/admin/newsletter/${current.id}`);
    await expect(page.locator('#week-start')).toHaveValue('2026-05-11');
    await page.locator('#week-start').fill('2026-05-04');
    await page.locator('#week-end').fill('2026-05-10');
    await page.getByRole('button', { name: 'Save Edits' }).click();

    await expect
      .poll(() => (lastPatchPayload as Record<string, unknown> | null)?.week_start)
      .toBe('2026-05-04');
    expect(
      (lastPatchPayload as Record<string, unknown> | null)?.week_end
    ).toBe('2026-05-10');
  });

  test('posted newsletter is read-only', async ({ page }) => {
    const current = makeDraft({
      id: '00000000-0000-0000-0000-000000000003',
      status: 'posted',
      posted_at: '2026-05-12T13:00:00Z',
      posted_by: 'pioneer@f3marietta.com',
      slack_message_ts: '1715000000.000001',
    });

    await page.route(`**/api/admin/newsletter/${current.id}`, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(current),
      });
    });

    await page.goto(`/admin/newsletter/${current.id}`);
    await expect(page.getByRole('heading', { name: 'Newsletter (posted)' })).toBeVisible();
    await expect(page.getByLabel('Live context / notes for AI')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Approve & Post/i })).toHaveCount(0);
    await expect(page.locator('#week-start')).toBeDisabled();
  });
});
