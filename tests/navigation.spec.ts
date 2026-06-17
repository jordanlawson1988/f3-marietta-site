import { test, expect } from "@playwright/test";

const NAV_LINKS = ["Home", "About", "Workouts", "Backblasts", "New Here", "Contact"];

test.describe("Navigation (redesign)", () => {
  test("desktop nav shows all links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    for (const label of NAV_LINKS) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Find a Workout/i }).first()).toBeVisible();
  });

  test("mobile nav drawer opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto("/");
    const burger = page.getByRole("button", { name: /Open menu/i });
    await burger.click();
    for (const label of NAV_LINKS) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
  });

  test("top bar renders on every page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Gloom Status: Active/i)).toBeVisible();
  });

  // Regression: a sticky header with a backdrop-filter (frosted glass) ghosts a stale,
  // offset copy of the page content on iOS Safari when the viewport scrolls/resizes.
  // The sticky header must have NO backdrop-filter and a fully opaque background.
  test("sticky header has no backdrop-filter and an opaque background (iOS ghosting regression)", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();

    const { backdropFilter, backgroundColor } = await header.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        backdropFilter:
          s.backdropFilter || (s as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "none",
        backgroundColor: s.backgroundColor,
      };
    });

    expect(backdropFilter).toBe("none");

    const alpha = (() => {
      const m = backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) return 0;
      const parts = m[1].split(",").map((p) => p.trim());
      return parts.length === 4 ? parseFloat(parts[3]) : 1;
    })();
    expect(alpha).toBe(1);
  });
});
