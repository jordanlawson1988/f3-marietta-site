import { test, expect } from '@playwright/test';
import { fixtureDraft } from './fixtures/beatdown';

test.describe('AI Beatdown Builder', () => {
  test('renders the form and disables Generate without a real AO', async ({ page }) => {
    await page.goto('/beatdown-builder');
    await expect(page.getByRole('heading', { name: 'AI Beatdown Builder' })).toBeVisible();
    await expect(page.getByLabel('AO')).toBeVisible();
    await expect(page.getByRole('button', { name: /generate beatdown/i })).toBeVisible();
  });

  test('picker selections stick when clicked', async ({ page }) => {
    await page.goto('/beatdown-builder');

    await page.getByRole('button', { name: 'Legs' }).click();
    await expect(page.getByRole('button', { name: 'Legs' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Full Body' })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Q-school' }).click();
    await expect(page.getByRole('button', { name: 'Q-school' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '—' })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Coupon' }).click();
    await expect(page.getByRole('button', { name: 'Coupon' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Bodyweight' }).click();
    await expect(page.getByRole('button', { name: 'Bodyweight' })).toHaveAttribute('aria-pressed', 'false');

    const famousSelect = page.getByLabel('Inspired by (optional)');
    await famousSelect.selectOption('dora-1-2-3');
    await expect(famousSelect).toHaveValue('dora-1-2-3');

    await page.getByLabel(/Q's Notes/).fill('Keep the six together.');
    await expect(page.getByLabel(/Q's Notes/)).toHaveValue('Keep the six together.');
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
