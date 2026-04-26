import { test, expect, devices } from "@playwright/test";

/**
 * Mobile UX contract for the global navigation:
 *   - Hamburger and overlay close button meet a 44×44pt touch target.
 *   - Opening the menu sets body[data-menu-open] so floating UI can hide.
 *   - The fullscreen overlay covers the AMA floating button (no bleed-through).
 *   - Closing the menu restores the floating button.
 */

test.use({ ...devices["iPhone 14"] });

test.describe("mobile global nav", () => {
  test("hamburger has a 44x44 touch target", async ({ page }) => {
    await page.goto("/");
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await expect(hamburger).toBeVisible();
    const box = await hamburger.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("opening the menu hides the AMA floating button + sets body data attr", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('button[aria-label="Open F3 AMA assistant"]')).toBeVisible();

    await page.click('button[aria-label="Open menu"]');
    // Allow fade-in transition
    await page.waitForTimeout(300);

    const menuOpen = await page.evaluate(() => document.body.dataset.menuOpen);
    expect(menuOpen).toBe("true");

    // AMA either hidden via display/visibility or removed from a11y tree
    await expect(page.locator('button[aria-label="Open F3 AMA assistant"]')).toBeHidden();

    // Overlay nav links visible and large
    const homeLink = page.locator('#mobile-menu-panel a:has-text("Home")');
    await expect(homeLink).toBeVisible();
    const homeBox = await homeLink.boundingBox();
    expect(homeBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("closing the overlay restores the floating button", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Open menu"]');
    await page.waitForTimeout(300);
    await page.click('button[aria-label="Close menu"]');
    await page.waitForTimeout(300);

    const menuOpen = await page.evaluate(() => document.body.dataset.menuOpen);
    expect(menuOpen).toBeFalsy();
    await expect(page.locator('button[aria-label="Open F3 AMA assistant"]')).toBeVisible();
  });

  test("topbar muster link fits on a single line at iPhone width", async ({ page }) => {
    await page.goto("/");
    // Mobile shows the link as "Next · MON 5:30am · The Battlefield →".
    // Locate via the link role rather than literal text so future copy
    // tweaks don't fragility-break this regression guard.
    const musterLink = page.getByRole("link", { name: /next muster:/i });
    await expect(musterLink).toBeVisible();
    const box = await musterLink.boundingBox();
    // 44px is the rough single-line height bound at this font-size. The
    // pre-fix bar wrapped to 2 lines hitting ~50px+. <40 catches wraps.
    expect(box?.height).toBeLessThan(40);
  });
});
