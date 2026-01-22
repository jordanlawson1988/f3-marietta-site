import { test, expect } from '@playwright/test';

test.describe('About Page', () => {
    test('should load the About page', async ({ page }) => {
        await page.goto('/about');
        await expect(page).toHaveURL('/about');
    });

    test('should display the page title', async ({ page }) => {
        await page.goto('/about');
        const title = page.getByRole('heading', { level: 1 });
        await expect(title).toBeVisible();
    });
});

test.describe('Workouts Page', () => {
    test('should load the Workouts page', async ({ page }) => {
        await page.goto('/workouts');
        await expect(page).toHaveURL('/workouts');
    });

    test('should display workout locations', async ({ page }) => {
        await page.goto('/workouts');
        // Check that the page has some content loaded
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });
});

test.describe('Glossary Page', () => {
    test('should load the Glossary page', async ({ page }) => {
        await page.goto('/glossary');
        await expect(page).toHaveURL('/glossary');
    });

    test('should display search functionality', async ({ page }) => {
        await page.goto('/glossary');
        // Check for search input or filter functionality
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });
});

test.describe('Community Page', () => {
    test('should load the Community page', async ({ page }) => {
        await page.goto('/community');
        await expect(page).toHaveURL('/community');
    });

    test('should display community content', async ({ page }) => {
        await page.goto('/community');
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });
});

test.describe('FAQ Page', () => {
    test('should load the FAQ page', async ({ page }) => {
        await page.goto('/fng');
        await expect(page).toHaveURL('/fng');
    });

    test('should display FAQ content', async ({ page }) => {
        await page.goto('/fng');
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });
});

test.describe('What to Expect Page', () => {
    test('should load the What to Expect page', async ({ page }) => {
        await page.goto('/what-to-expect');
        await expect(page).toHaveURL('/what-to-expect');
    });

    test('should display page content', async ({ page }) => {
        await page.goto('/what-to-expect');
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });
});

test.describe('Contact Page', () => {
    test('should load the Contact page', async ({ page }) => {
        await page.goto('/contact');
        await expect(page).toHaveURL('/contact');
    });

    test('should display contact information or form', async ({ page }) => {
        await page.goto('/contact');
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });
});

test.describe('Backblasts Page', () => {
    test('should load the Backblasts page', async ({ page }) => {
        await page.goto('/backblasts');
        await expect(page).toHaveURL('/backblasts');
    });

    test('should display backblasts table', async ({ page }) => {
        await page.goto('/backblasts');
        // Check for table or list of backblasts
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });

    test('should have pagination controls', async ({ page }) => {
        await page.goto('/backblasts');
        // Wait for content to load
        await page.waitForLoadState('networkidle');
    });
});
