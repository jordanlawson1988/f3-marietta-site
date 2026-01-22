import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the header logo', async ({ page }) => {
        const logo = page.getByRole('link', { name: /F3 Marietta logo/i }).first();
        await expect(logo).toBeVisible();
    });

    test('should have logo linking to homepage', async ({ page }) => {
        const logo = page.getByRole('link', { name: /F3 Marietta logo/i }).first();
        await expect(logo).toHaveAttribute('href', '/');
    });

    test('should navigate to About page', async ({ page }) => {
        await page.getByRole('link', { name: 'About' }).first().click();
        await expect(page).toHaveURL('/about');
    });

    test('should navigate to Workouts page via nav', async ({ page }) => {
        await page.getByRole('link', { name: 'Find a Workout' }).first().click();
        await expect(page).toHaveURL('/workouts');
    });

    test('should navigate to Glossary page', async ({ page }) => {
        await page.getByRole('link', { name: 'F3 Terms' }).first().click();
        await expect(page).toHaveURL('/glossary');
    });

    test('should navigate to Community page', async ({ page }) => {
        await page.getByRole('link', { name: 'Community' }).first().click();
        await expect(page).toHaveURL('/community');
    });

    test('should navigate to FAQ page', async ({ page }) => {
        await page.getByRole('link', { name: 'FAQ' }).first().click();
        await expect(page).toHaveURL('/fng');
    });

    test('should navigate to What to Expect page', async ({ page }) => {
        await page.getByRole('link', { name: 'What to Expect' }).first().click();
        await expect(page).toHaveURL('/what-to-expect');
    });

    test('should navigate to Contact page', async ({ page }) => {
        await page.getByRole('link', { name: 'Contact Us' }).first().click();
        await expect(page).toHaveURL('/contact');
    });

    test('should have external link to F3 Gear', async ({ page }) => {
        const gearLink = page.getByRole('link', { name: 'F3 Gear' }).first();
        await expect(gearLink).toHaveAttribute('href', 'https://f3gear.com/');
    });
});

test.describe('Footer Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display footer with Quick Links section', async ({ page }) => {
        const quickLinks = page.getByRole('heading', { name: 'Quick Links' });
        await expect(quickLinks).toBeVisible();
    });

    test('should display footer with Connect section', async ({ page }) => {
        const connect = page.getByRole('heading', { name: 'Connect' });
        await expect(connect).toBeVisible();
    });

    test('should have footer link to About Us', async ({ page }) => {
        const aboutLink = page.getByRole('contentinfo').getByRole('link', { name: 'About Us' });
        await expect(aboutLink).toBeVisible();
        await expect(aboutLink).toHaveAttribute('href', '/about');
    });

    test('should have footer link to Workouts', async ({ page }) => {
        const workoutsLink = page.getByRole('contentinfo').getByRole('link', { name: 'Workouts' });
        await expect(workoutsLink).toBeVisible();
        await expect(workoutsLink).toHaveAttribute('href', '/workouts');
    });

    test('should have external link to F3 Nation', async ({ page }) => {
        const nationLink = page.getByRole('link', { name: 'F3 Nation' });
        await expect(nationLink).toHaveAttribute('href', 'https://f3nation.com/');
    });

    test('should have external link to Q-Source', async ({ page }) => {
        const qSourceLink = page.getByRole('link', { name: 'Q-Source' });
        await expect(qSourceLink).toHaveAttribute('href', 'https://f3nation.com/q-source');
    });

    test('should have social links in footer', async ({ page }) => {
        const facebookLink = page.getByRole('contentinfo').getByRole('link', { name: 'Facebook' });
        const instagramLink = page.getByRole('contentinfo').getByRole('link', { name: 'Instagram' });

        await expect(facebookLink).toBeVisible();
        await expect(instagramLink).toBeVisible();
    });

    test('should display copyright notice', async ({ page }) => {
        const copyright = page.getByText(/© \d{4} F3 Marietta/);
        await expect(copyright).toBeVisible();
    });
});

test.describe('Mobile Navigation', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display mobile menu toggle button', async ({ page }) => {
        await page.goto('/');
        const menuButton = page.getByRole('button', { name: /toggle menu/i });
        await expect(menuButton).toBeVisible();
    });

    test('should open mobile menu when toggle is clicked', async ({ page }) => {
        await page.goto('/');
        const menuButton = page.getByRole('button', { name: /toggle menu/i });
        await menuButton.click();

        // Check that navigation links are visible after opening menu
        const homeLink = page.getByRole('link', { name: 'Home' });
        await expect(homeLink).toBeVisible();
    });
});
