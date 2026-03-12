import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the hero section with F3 Marietta title', async ({ page }) => {
        const heroTitle = page.getByRole('heading', { name: 'F3 MARIETTA', level: 1 });
        await expect(heroTitle).toBeVisible();
    });

    test('should display the hero subtitle', async ({ page }) => {
        const subtitle = page.getByText('Fitness, Fellowship, and Faith. Free, peer-led workouts for men in Marietta, GA.');
        await expect(subtitle).toBeVisible();
    });

    test('should have a "Find a Workout" CTA button in hero', async ({ page }) => {
        const ctaButton = page.getByRole('link', { name: 'Find a Workout' }).first();
        await expect(ctaButton).toBeVisible();
        await expect(ctaButton).toHaveAttribute('href', '/workouts');
    });

    test('should display the "What is F3?" section', async ({ page }) => {
        const sectionTitle = page.getByRole('heading', { name: 'WHAT IS F3?' });
        await expect(sectionTitle).toBeVisible();
    });

    test('should display the three F3 pillars', async ({ page }) => {
        const fitnessHeading = page.getByRole('heading', { name: 'Fitness', level: 3 });
        const fellowshipHeading = page.getByRole('heading', { name: 'Fellowship', level: 3 });
        const faithHeading = page.getByRole('heading', { name: 'Faith', level: 3 });

        await expect(fitnessHeading).toBeVisible();
        await expect(fellowshipHeading).toBeVisible();
        await expect(faithHeading).toBeVisible();
    });

    test('should display the "Who is F3 Marietta?" section', async ({ page }) => {
        const sectionTitle = page.getByRole('heading', { name: 'WHO IS F3 MARIETTA?' });
        await expect(sectionTitle).toBeVisible();
    });

    test('should have "Read Our Story" link to About page', async ({ page }) => {
        const readMoreLink = page.getByRole('link', { name: 'Read Our Story' });
        await expect(readMoreLink).toBeVisible();
        await expect(readMoreLink).toHaveAttribute('href', '/about');
    });

    test('should display the 5 Core Principles', async ({ page }) => {
        const principlesTitle = page.getByRole('heading', { name: 'THE 5 CORE PRINCIPLES' });
        await expect(principlesTitle).toBeVisible();

        // Check each principle is listed
        await expect(page.getByText('Free of charge')).toBeVisible();
        await expect(page.getByText('Open to all men', { exact: true })).toBeVisible();
        await expect(page.getByText('Held outdoors, rain or shine, heat or cold')).toBeVisible();
        await expect(page.getByText('Peer-led in a rotating fashion')).toBeVisible();
        await expect(page.getByText('Ends with a Circle of Trust (COT)')).toBeVisible();
    });

    test('should display the blockquote', async ({ page }) => {
        const quote = page.getByText('Leave no man behind, but leave no man where you found him.');
        await expect(quote).toBeVisible();
    });

    test('should display the "Ready to Join Us?" CTA section', async ({ page }) => {
        const ctaTitle = page.getByRole('heading', { name: 'READY TO JOIN US?' });
        await expect(ctaTitle).toBeVisible();

        const findLocation = page.getByRole('link', { name: 'Find a Location' });
        await expect(findLocation).toBeVisible();
        await expect(findLocation).toHaveAttribute('href', '/workouts');
    });
});
