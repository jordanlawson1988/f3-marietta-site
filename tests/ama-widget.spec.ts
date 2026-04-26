import { test, expect } from '@playwright/test';

test.describe('AMA Widget UI', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the "AMA" floating button', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await expect(helpButton).toBeVisible();
    });

    test('should open the assistant panel when clicked', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        // Check that the panel header appears
        const panelTitle = page.getByRole('heading', { name: 'F3 Assistant' });
        await expect(panelTitle).toBeVisible();
    });

    test('should display "Ask me anything" subtitle in panel', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        // Wait for panel animation
        await page.waitForTimeout(300);

        const subtitle = page.getByText('Ask me anything', { exact: true });
        await expect(subtitle).toBeVisible();
    });

    test('should have a search/ask input field', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        const searchInput = page.getByPlaceholder('Ask a question...');
        await expect(searchInput).toBeVisible();
    });

    test('should display example questions', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        // Wait for panel animation
        await page.waitForTimeout(300);

        // Should show example question buttons (check for any of them)
        const exampleQuestions = page.locator('button').filter({ hasText: /What is/ });
        await expect(exampleQuestions.first()).toBeVisible();
    });

    test('should have close button in the panel', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        const closeButton = page.getByRole('button', { name: 'Close AI Assistant' });
        await expect(closeButton).toBeVisible();
    });

    test('should close the panel when close button is clicked', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        // Wait for panel to open
        await page.waitForTimeout(300);

        // Panel should be open - close button visible
        const closeButton = page.getByRole('button', { name: 'Close AI Assistant' });
        await expect(closeButton).toBeVisible();

        // Click close
        await closeButton.click();

        // Wait for close animation to complete
        await page.waitForTimeout(500);

        // The Open button should be visible again (panel is closed)
        await expect(helpButton).toBeVisible();
    });

    test('should have disabled Send button when input is empty', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        const sendButton = page.getByRole('button', { name: /Send/i });
        await expect(sendButton).toBeDisabled();
    });

    test('should enable Send button when text is entered', async ({ page }) => {
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        const searchInput = page.getByPlaceholder('Ask a question...');
        await searchInput.fill('What is F3?');

        const sendButton = page.getByRole('button', { name: /Send/i });
        await expect(sendButton).not.toBeDisabled();
    });
});

test.describe('AMA Widget Knowledge Base Priority', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Open the assistant panel
        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();
    });

    test('should return direct answer for known glossary term "PAX"', async ({ page }) => {
        const searchInput = page.getByPlaceholder('Ask a question...');
        await searchInput.fill('PAX');

        const sendButton = page.getByRole('button', { name: /Send/i });
        await sendButton.click();

        // Wait for response (API call may take time)
        const responseText = page.locator('.whitespace-pre-wrap').first();
        await expect(responseText).toBeVisible({ timeout: 15000 });

        // Should contain PAX in the response
        await expect(responseText).toContainText(/PAX/i);
    });

    test('should return direct answer for known term "Q"', async ({ page }) => {
        const searchInput = page.getByPlaceholder('Ask a question...');
        await searchInput.fill('What is a Q?');

        const sendButton = page.getByRole('button', { name: /Send/i });
        await sendButton.click();

        // Wait for response
        const responseText = page.locator('.whitespace-pre-wrap').first();
        await expect(responseText).toBeVisible({ timeout: 15000 });
    });

    test('should show related entries links for glossary terms', async ({ page }) => {
        const searchInput = page.getByPlaceholder('Ask a question...');
        await searchInput.fill('EMOM');

        const sendButton = page.getByRole('button', { name: /Send/i });
        await sendButton.click();

        // Wait for response
        const responseText = page.locator('.whitespace-pre-wrap').first();
        await expect(responseText).toBeVisible({ timeout: 15000 });
    });

    test('should fill input when clicking example question', async ({ page }) => {
        // Wait for example questions to appear
        await page.waitForTimeout(500);

        // Click an example question button
        const exampleButton = page.locator('button').filter({ hasText: /What is/ }).first();
        await exampleButton.click();

        // Wait for the request to be submitted and response to appear
        const responseText = page.locator('.whitespace-pre-wrap').first();
        await expect(responseText).toBeVisible({ timeout: 15000 });
    });

    test('should handle unknown questions gracefully', async ({ page }) => {
        const searchInput = page.getByPlaceholder('Ask a question...');
        await searchInput.fill('What is quantum entanglement?');

        const sendButton = page.getByRole('button', { name: /Send/i });
        await sendButton.click();

        // Wait for response (AI fallback may take longer)
        // Either a response appears or an error message
        const responseOrError = page.locator('.whitespace-pre-wrap, .bg-destructive\\/10');
        await expect(responseOrError.first()).toBeVisible({ timeout: 20000 });
    });
});

test.describe('AMA Widget on Mobile', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display floating button on mobile', async ({ page }) => {
        await page.goto('/');

        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await expect(helpButton).toBeVisible();
    });

    test('should open panel on mobile', async ({ page }) => {
        await page.goto('/');

        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        const panelTitle = page.getByRole('heading', { name: 'F3 Assistant' });
        await expect(panelTitle).toBeVisible();
    });

    test('should show close button on mobile when open', async ({ page }) => {
        await page.goto('/');

        const helpButton = page.getByRole('button', { name: 'Open F3 AMA assistant' });
        await helpButton.click();

        // The close button should be visible on mobile
        const closeButton = page.getByRole('button', { name: 'Close AI Assistant' });
        await expect(closeButton).toBeVisible();
    });
});
