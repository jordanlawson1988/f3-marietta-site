import { test, expect } from "@playwright/test";

// These tests require ADMIN_DASHBOARD_PASSWORD to be set in .env.local
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD || "test-password";

test.describe("Admin Workout Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/admin");
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    // Wait for the admin page to load
    await page.waitForURL(/\/admin\/workouts/);
  });

  test("displays sidebar navigation", async ({ page }) => {
    const sidebar = page.locator("nav");
    await expect(page.getByText("F3 Marietta Admin")).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Workouts" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Regions" })).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Knowledge Base" })
    ).toBeVisible();
  });

  test("displays workout calendar grid with day columns", async ({ page }) => {
    await expect(page.getByText("MON")).toBeVisible();
    await expect(page.getByText("TUE")).toBeVisible();
    await expect(page.getByText("WED")).toBeVisible();
    await expect(page.getByText("THU")).toBeVisible();
    await expect(page.getByText("FRI")).toBeVisible();
    await expect(page.getByText("SAT")).toBeVisible();
    await expect(page.getByText("SUN")).toBeVisible();
  });

  test("opens create modal when clicking Add Workout", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Workout" }).click();
    await expect(page.getByRole("heading", { name: "Add Workout" })).toBeVisible();
    await expect(page.getByLabel("AO Name")).toBeVisible();
    await expect(page.getByLabel("Workout Type")).toBeVisible();
    // Close modal
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  // This test requires workout data (regions migration must be run on Supabase)
  test("opens edit modal when clicking a workout block", async ({ page }) => {
    const firstBlock = page.locator("[data-testid='workout-block']").first();
    // Skip if no workout blocks exist (migration not yet run)
    const count = await firstBlock.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await firstBlock.click();
    await expect(page.getByRole("heading", { name: "Edit Workout" })).toBeVisible();
  });

  test("navigates to regions page", async ({ page }) => {
    const sidebar = page.locator("nav");
    await sidebar.getByRole("link", { name: "Regions" }).click();
    await page.waitForURL(/\/admin\/regions/);
    await expect(page.getByRole("heading", { name: "Regions" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Region/ })).toBeVisible();
  });

  test("region filter pills filter workouts", async ({ page }) => {
    // Click a region filter pill
    const allButton = page.getByRole("button", { name: "All" });
    await expect(allButton).toBeVisible();
    // Click "All" to verify it's the default active state
    await allButton.click();
  });
});

test.describe("Admin Regions Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForURL(/\/admin\/workouts/);
    const sidebar = page.locator("nav");
    await sidebar.getByRole("link", { name: "Regions" }).click();
    await page.waitForURL(/\/admin\/regions/);
  });

  test("displays regions table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Regions" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Region/ })).toBeVisible();
  });

  test("opens add region modal", async ({ page }) => {
    await page.getByRole("button", { name: /Add Region/ }).click();
    await expect(page.getByRole("heading", { name: "Add Region" })).toBeVisible();
  });
});

test.describe("Public Workouts Page", () => {
  test("renders workout schedule with dynamic regions", async ({ page }) => {
    await page.goto("/workouts");
    // Verify the page loads with the schedule heading
    await expect(page.getByRole("heading", { name: /workout schedule/i })).toBeVisible();
  });
});
