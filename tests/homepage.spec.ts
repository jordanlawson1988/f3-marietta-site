import { test, expect } from "@playwright/test";

test.describe("Home page (redesign)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders hero H1 and lede", async ({ page }) => {
    const h1 = page.locator("h1").first();
    await expect(h1).toContainText(/Hold the/i);
    await expect(h1).toContainText(/Battlefield/i);
    await expect(h1).toContainText(/Leave no man/i);
    await expect(page.getByText(/Free, peer-led workouts/i).first()).toBeVisible();
  });

  test("hero CTAs are visible and linked", async ({ page }) => {
    const primary = page.getByRole("link", { name: /Find a Workout/i }).first();
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute("href", /\/workouts/);
  });

  test("Three F's section renders with three cards", async ({ page }) => {
    await expect(page.locator("#about")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Fitness$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Fellowship$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Faith$/ })).toBeVisible();
  });

  test("creed pull quote is present", async ({ page }) => {
    await expect(page.getByText(/Leave no man behind/i).first()).toBeVisible();
    await expect(page.getByText(/where you found him/i)).toBeVisible();
  });

  test("workouts preview has a filter and at least one AO card", async ({ page }) => {
    await expect(page.locator("#workouts")).toBeVisible();
    await expect(page.getByPlaceholder(/Search AOs/i)).toBeVisible();
  });

  test("backblasts preview section renders", async ({ page }) => {
    await expect(page.locator("#reports")).toBeVisible();
    await expect(page.getByRole("link", { name: /All reports/i })).toBeVisible();
  });

  test("impact section shows 4 numeric tiles", async ({ page }) => {
    const tiles = page.locator("text=/HIM|Workouts Led|Active AOs|FNGs/i");
    await expect(tiles.first()).toBeVisible();
  });

  test("join CTA and footer render", async ({ page }) => {
    await expect(page.locator("#new")).toBeVisible();
    await expect(page.getByText(/Plan Your First Post/i)).toBeVisible();
    await expect(page.getByText(/A Region of F3 Nation/i)).toBeVisible();
  });
});
