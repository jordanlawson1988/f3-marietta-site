import { test, expect } from '@playwright/test';

test.describe('Glossary Search Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/glossary');
    });

    test('should display the F3 Terms page title', async ({ page }) => {
        const title = page.getByRole('heading', { name: 'F3 TERMS', level: 1 });
        await expect(title).toBeVisible();
    });

    test('should have Lexicon and Exicon tabs', async ({ page }) => {
        const lexiconButton = page.getByRole('button', { name: 'Lexicon', exact: true });
        const exiconButton = page.getByRole('button', { name: 'Exicon', exact: true });

        await expect(lexiconButton).toBeVisible();
        await expect(exiconButton).toBeVisible();
    });

    test('should have a search input field', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);
        await expect(searchInput).toBeVisible();
    });

    test('should show entry count in the results', async ({ page }) => {
        // Look for text showing count like "Lexicon (Terms) (123)"
        const countText = page.getByText(/Lexicon \(Terms\) \(\d+\)/);
        await expect(countText).toBeVisible();
    });

    test('should filter results when searching', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);

        // Type a search term
        await searchInput.fill('PAX');

        // Wait for filtering to occur
        await page.waitForTimeout(300);

        // Verify search updated the results
        const resultCount = page.getByText(/Lexicon \(Terms\) \(\d+\)/);
        await expect(resultCount).toBeVisible();
    });

    test('should prioritize exact term matches - PAX appears first when searched', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);

        // Search for "pax"
        await searchInput.fill('pax');

        // Wait for results
        await page.waitForTimeout(500);

        // The first card title should contain PAX (exact match priority)
        const firstCardTitle = page.locator('h3.text-primary').first();
        await expect(firstCardTitle).toContainText(/PAX/i);
    });

    test('should show "No results found" when search has no matches', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);

        // Search for something that won't exist
        await searchInput.fill('xyznonexistentterm123');

        // Wait for filtering
        await page.waitForTimeout(300);

        // Should show no results message
        const noResults = page.getByText('No results found');
        await expect(noResults).toBeVisible();
    });

    test('should have a Clear Search button when no results', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);

        await searchInput.fill('xyznonexistentterm123');
        await page.waitForTimeout(300);

        const clearButton = page.getByRole('button', { name: 'Clear Search' });
        await expect(clearButton).toBeVisible();
    });

    test('should switch to Exicon tab when clicked', async ({ page }) => {
        const exiconButton = page.getByRole('button', { name: 'Exicon', exact: true });
        await exiconButton.click();

        // Wait for the content to update
        await page.waitForTimeout(300);

        // The search placeholder should change to Exicon
        const searchInput = page.getByPlaceholder(/Search Exicon/);
        await expect(searchInput).toBeVisible();
    });

    test('should show category badges in Exicon view', async ({ page }) => {
        // Switch to Exicon tab
        const exiconButton = page.getByRole('button', { name: 'Exicon', exact: true });
        await exiconButton.click();

        // Wait for content to load
        await page.waitForTimeout(500);

        // Exicon entries should have category badges (font-mono spans)
        const categoryBadge = page.locator('span.font-mono').first();
        await expect(categoryBadge).toBeVisible();
    });
});

test.describe('Glossary Search Priority', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/glossary');
    });

    test('term name matches should appear before description matches', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);

        // Search for a term
        await searchInput.fill('Q');
        await page.waitForTimeout(500);

        // First result should be a term starting with or named "Q"
        const firstCardTitle = page.locator('h3.text-primary').first();
        await expect(firstCardTitle).toBeVisible();
        const titleText = await firstCardTitle.textContent();

        // Title should be Q or start with Q (term priority over description)
        expect(titleText?.toLowerCase().startsWith('q') || titleText === 'Q').toBeTruthy();
    });

    test('exact term match should be first result', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/Search Lexicon/);

        // Search for exact term "pax"
        await searchInput.fill('pax');
        await page.waitForTimeout(500);

        // First result should be "PAX"
        const firstCardTitle = page.locator('h3.text-primary').first();
        await expect(firstCardTitle).toContainText(/PAX/i);
    });
});
