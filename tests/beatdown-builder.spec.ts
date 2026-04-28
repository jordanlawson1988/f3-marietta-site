import { test, expect } from '@playwright/test';
import { fixtureDraft } from './fixtures/beatdown';

test.describe('AI Beatdown Builder', () => {
  test('renders the form and disables Generate without a real AO', async ({ page }) => {
    await page.goto('/beatdown-builder');
    await expect(page.getByRole('heading', { name: 'AI Beatdown Builder' })).toBeVisible();
    await expect(page.getByLabel('AO')).toBeVisible();
    await expect(page.getByRole('button', { name: /generate beatdown/i })).toBeVisible();
  });

  test('renders generated beatdown when API returns a draft', async ({ page }) => {
    await page.route('**/api/beatdown/generate', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: fixtureDraft.title,
        sections: fixtureDraft.sections,
        generation_ms: 1234,
        model: 'gemini-2.5-flash',
        knowledge_version: null,
      }),
    }));

    await page.goto('/beatdown-builder');
    const aoSelect = page.getByLabel('AO');
    const firstOption = await aoSelect.locator('option').first().getAttribute('value');
    if (firstOption) await aoSelect.selectOption(firstOption);
    await page.getByRole('button', { name: /generate beatdown/i }).click();

    await expect(page.getByRole('heading', { name: fixtureDraft.title, level: 2 })).toBeVisible();
    await expect(page.getByText('SSH')).toBeVisible();
    await expect(page.getByText('11s on the back hill')).toBeVisible();
    await expect(page.getByRole('button', { name: /copy as slackblast/i })).toBeVisible();
  });

  test('saved view renders by short_id', async ({ page }) => {
    await page.goto('/beatdown/zzzzzzzz');
    await expect(page).toHaveTitle(/not found|404/i);
  });
});
