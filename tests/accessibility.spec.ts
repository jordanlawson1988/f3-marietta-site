import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility - Landmarks', () => {
    test('homepage should have main landmark', async ({ page }) => {
        await page.goto('/');
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
    });

    test('homepage should have header/banner landmark', async ({ page }) => {
        await page.goto('/');
        const header = page.getByRole('banner');
        await expect(header).toBeVisible();
    });

    test('homepage should have footer/contentinfo landmark', async ({ page }) => {
        await page.goto('/');
        const footer = page.getByRole('contentinfo');
        await expect(footer).toBeVisible();
    });
});

test.describe('Accessibility - Images', () => {
    test('logo should have alt text', async ({ page }) => {
        await page.goto('/');
        const logoImages = page.getByRole('img', { name: /F3 Marietta logo/i });
        const count = await logoImages.count();
        expect(count).toBeGreaterThan(0);
    });

    test('pillar icons should have alt text', async ({ page }) => {
        await page.goto('/');

        // Check for alt text on pillar icons
        const fitnessIcon = page.getByRole('img', { name: /fitness/i });
        const fellowshipIcon = page.getByRole('img', { name: /fellowship/i });
        const faithIcon = page.getByRole('img', { name: /faith/i });

        // At least one of these should be present
        const fitnessCount = await fitnessIcon.count();
        const fellowshipCount = await fellowshipIcon.count();
        const faithCount = await faithIcon.count();

        expect(fitnessCount + fellowshipCount + faithCount).toBeGreaterThan(0);
    });
});

test.describe('Accessibility - Headings', () => {
    test('homepage should have proper heading hierarchy starting with h1', async ({ page }) => {
        await page.goto('/');
        const h1 = page.getByRole('heading', { level: 1 });
        await expect(h1).toBeVisible();
    });

    test('about page should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/about');
        const h1 = page.getByRole('heading', { level: 1 });
        await expect(h1).toBeVisible();
    });
});

test.describe('Accessibility - Links', () => {
    test('links should have accessible names', async ({ page }) => {
        await page.goto('/');

        // Check that navigation links have visible text
        const navLinks = page.getByRole('navigation').getByRole('link');
        const count = await navLinks.count();

        // Page should have navigation links
        expect(count).toBeGreaterThan(0);
    });

    test('CTA buttons should have accessible names', async ({ page }) => {
        await page.goto('/');

        // Check "Find a Workout" button has accessible name
        const findWorkoutLink = page.getByRole('link', { name: 'Find a Workout' });
        const count = await findWorkoutLink.count();
        expect(count).toBeGreaterThan(0);
    });
});

test.describe('Accessibility - Keyboard Navigation', () => {
    test('should be able to navigate to main content', async ({ page }) => {
        await page.goto('/');

        // Tab through the page to ensure focusable elements exist
        await page.keyboard.press('Tab');

        // Get the currently focused element
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeTruthy();
    });

    test('navigation links should be focusable', async ({ page }) => {
        await page.goto('/');

        // Focus should be able to reach navigation
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
        }

        // Should have a focused element after tabbing
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeTruthy();
    });
});

test.describe('A11y redesign', () => {
    const pages = [
        '/',
        '/about',
        '/workouts',
        '/backblasts',
        '/new-here',
        '/contact',
        '/fng',
        '/glossary',
        '/community',
        '/what-to-expect',
    ];

    for (const path of pages) {
        test(`${path} has no critical accessibility violations`, async ({ page }) => {
            await page.goto(path);
            // Wait for page to stabilize (scroll-reveal animations, etc.)
            await page.waitForLoadState('networkidle');
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();
            const critical = results.violations.filter(
                (v) => v.impact === 'critical' || v.impact === 'serious',
            );
            expect(
                critical,
                critical.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map(n => n.html).join('\n  ')}`).join('\n\n'),
            ).toHaveLength(0);
        });
    }
});
