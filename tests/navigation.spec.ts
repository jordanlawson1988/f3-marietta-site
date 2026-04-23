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
});
