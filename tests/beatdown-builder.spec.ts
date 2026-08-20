import { test, expect, type Page } from '@playwright/test';
import { fixtureDraft } from './fixtures/beatdown';

const INTEL = {
  ao_display_name: 'The Battlefield',
  confidence: 'strong',
  window: 10,
  on_file: 41,
  knowledge_version: 37,
  knowledge_generated_at: '2026-08-20T07:02:00.000Z',
  source_event_count: 124,
  knowledge_stale: false,
  ao_intel: {
    top_exercises: ['Merkin', 'Squat'],
    common_formats: ['11s on the back hill'],
    voice_samples: ['The gloom delivered.'],
    crowd_pleasers: ['Route 66'],
    recent_trends: ['Coupon work up since June'],
  },
  ledger: [
    { term: 'Merkin', used: 8, window: 10, last_used: '2026-08-15' },
    { term: 'Squat', used: 7, window: 10, last_used: '2026-08-15' },
  ],
  sources: [{ event_date: '2026-08-15', q_name: 'Hammer', title: '11s on the back hill' }],
};

const GENERATED = {
  title: fixtureDraft.title,
  sections: fixtureDraft.sections,
  generation_ms: 1234,
  model: 'gemini-3.1-pro-preview',
  knowledge_version: 37,
  intel: INTEL,
  locks_honored: 2,
};

async function mockIntel(page: Page) {
  await page.route('**/api/beatdown/intel*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INTEL) }),
  );
}

async function mockGenerate(page: Page) {
  await page.route('**/api/beatdown/generate', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GENERATED) }),
  );
}

test.describe('AI Beatdown Builder', () => {
  test('renders the brief and the intel rail', async ({ page }) => {
    await mockIntel(page);
    await page.goto('/beatdown-builder');

    await expect(page.getByRole('heading', { name: 'Build a beatdown.', level: 1 })).toBeVisible();
    await expect(page.getByRole('group', { name: 'AO' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Archive intel' })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate beatdown/i })).toBeVisible();
  });

  test('picker selections stick when clicked', async ({ page }) => {
    await mockIntel(page);
    await page.goto('/beatdown-builder');

    await page.getByRole('button', { name: 'Legs', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Legs', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Full Body', exact: true })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Q-school', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Q-school', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'None', exact: true })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Coupon', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Coupon', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Bodyweight', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Bodyweight', exact: true })).toHaveAttribute('aria-pressed', 'false');

    const famousSelect = page.getByLabel('Inspired by');
    await famousSelect.selectOption('dora-1-2-3');
    await expect(famousSelect).toHaveValue('dora-1-2-3');

    await page.getByLabel(/Q's Notes/).fill('Keep the six together.');
    await expect(page.getByLabel(/Q's Notes/)).toHaveValue('Keep the six together.');
  });

  test('the repeat ledger shows what ran recently and how often', async ({ page }) => {
    await mockIntel(page);
    await page.goto('/beatdown-builder');

    const rail = page.getByRole('complementary', { name: 'Archive intel' });
    await expect(rail.getByText('Strong history')).toBeVisible();
    await expect(rail.getByText('8/10')).toBeVisible();
    await expect(rail.getByRole('button', { name: /Merkin/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(rail.getByText('2 locked', { exact: true })).toBeVisible();
  });

  test('releasing a locked term reaches the generate request', async ({ page }) => {
    await mockIntel(page);

    let sentReleased: string[] | undefined;
    await page.route('**/api/beatdown/generate', async (route) => {
      sentReleased = route.request().postDataJSON()?.released_terms;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GENERATED),
      });
    });

    await page.goto('/beatdown-builder');
    const rail = page.getByRole('complementary', { name: 'Archive intel' });

    await rail.getByRole('button', { name: /Merkin/ }).click();
    await expect(rail.getByRole('button', { name: /Merkin/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(rail.getByText('1 locked', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /generate beatdown/i }).click();
    await expect(page.getByRole('heading', { name: fixtureDraft.title, level: 2 })).toBeVisible();

    expect(sentReleased).toEqual(['Merkin']);
  });

  test('renders the generated beatdown with its provenance', async ({ page }) => {
    await mockIntel(page);
    await mockGenerate(page);

    await page.goto('/beatdown-builder');
    await page.getByRole('button', { name: /generate beatdown/i }).click();

    await expect(page.getByRole('heading', { name: fixtureDraft.title, level: 2 })).toBeVisible();
    await expect(page.getByText('SSH')).toBeVisible();
    await expect(page.getByText('11s on the back hill').first()).toBeVisible();
    await expect(page.getByText('gemini-3.1-pro-preview')).toBeVisible();
    await expect(page.getByText('v37')).toBeVisible();
    await expect(page.getByRole('button', { name: /copy as slackblast/i })).toBeVisible();
  });

  test('a dead intel endpoint still lets the Q generate', async ({ page }) => {
    await page.route('**/api/beatdown/intel*', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable', message: 'Archive intel is temporarily unavailable.' }),
      }),
    );
    await mockGenerate(page);

    await page.goto('/beatdown-builder');
    await expect(page.getByText(/Archive intel is temporarily unavailable/)).toBeVisible();
    await page.getByRole('button', { name: /generate beatdown/i }).click();
    await expect(page.getByRole('heading', { name: fixtureDraft.title, level: 2 })).toBeVisible();
  });

  test('saved view renders by short_id', async ({ page }) => {
    await page.goto('/beatdown/zzzzzzzz');
    await expect(page).toHaveTitle(/not found|404/i);
  });

  // Regression: on iOS Safari, a sticky bar with a backdrop-filter (and no opaque
  // background) renders a stale, ghosted duplicate of the content behind it when the
  // soft keyboard opens during inline edits — the "overlapping text" mobile bug.
  // The action bar must therefore have NO backdrop-filter and a fully opaque background.
  test('mobile action bar has no backdrop-filter and an opaque background (inline-edit ghosting regression)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12 logical viewport
    await mockIntel(page);
    await mockGenerate(page);

    await page.goto('/beatdown-builder');
    await page.getByRole('button', { name: /generate beatdown/i }).click();

    const copyBtn = page.getByRole('button', { name: /copy as slackblast/i });
    await expect(copyBtn).toBeVisible();

    const actionBar = copyBtn.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " sticky ")][1]',
    );
    await expect(actionBar).toHaveCount(1);

    const { backdropFilter, backgroundColor } = await actionBar.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        backdropFilter:
          s.backdropFilter || (s as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none',
        backgroundColor: s.backgroundColor,
      };
    });

    expect(backdropFilter).toBe('none');

    const alpha = (() => {
      const m = backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) return 0;
      const parts = m[1].split(',').map((p) => p.trim());
      return parts.length === 4 ? parseFloat(parts[3]) : 1;
    })();
    expect(alpha).toBe(1);
  });

  test('the intel rail collapses on a phone so the brief is reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockIntel(page);
    await page.goto('/beatdown-builder');

    const toggle = page.getByRole('button', { name: /10 read · 2 locked · show/i });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(page.getByRole('button', { name: /hide the intel/i })).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('The Ledger', () => {
  test('renders knowledge status, the repeat table, and archive coverage', async ({ page }) => {
    await page.route('**/api/beatdown/intel*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INTEL) }),
    );

    await page.goto('/beatdown-builder/ledger');

    await expect(page.getByRole('heading', { name: 'The Ledger', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Knowledge v37/ })).toBeVisible();
    await expect(page.getByText('Fresh', { exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Merkin', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '8 of 10' })).toBeVisible();
    await expect(page.getByText('Archive coverage')).toBeVisible();
  });

  test('stale knowledge is reported as blind, not hidden', async ({ page }) => {
    await page.route('**/api/beatdown/intel*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...INTEL, knowledge_version: 34, knowledge_stale: true }),
      }),
    );

    await page.goto('/beatdown-builder/ledger');
    await expect(page.getByRole('heading', { name: /Knowledge v34/ })).toBeVisible();
    await expect(page.getByText('Blind', { exact: true })).toBeVisible();
    await expect(page.getByText(/generation has dropped it entirely/)).toBeVisible();
  });
});
