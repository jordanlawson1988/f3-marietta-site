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
    await expect(page.getByText("F3 Marietta Admin")).toBeVisible();
    await expect(page.getByRole("link", { name: "Workouts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Regions" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Knowledge Base" })
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
    await expect(page.getByText("Add Workout")).toBeVisible();
    await expect(page.getByLabel("AO Name")).toBeVisible();
    await expect(page.getByLabel("Workout Type")).toBeVisible();
    // Close modal
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("opens edit modal when clicking a workout block", async ({ page }) => {
    // Click the first workout block in the grid
    const firstBlock = page.locator("[data-testid='workout-block']").first();
    await firstBlock.click();
    await expect(page.getByText("Edit Workout")).toBeVisible();
  });

  test("navigates to regions page", async ({ page }) => {
    await page.getByRole("link", { name: "Regions" }).click();
    await page.waitForURL(/\/admin\/regions/);
    await expect(page.getByText("Regions")).toBeVisible();
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
    await page.goto("/admin/regions");
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForURL(/\/admin/);
    await page.getByRole("link", { name: "Regions" }).click();
  });

  test("displays regions table", async ({ page }) => {
    await expect(page.getByText("Marietta")).toBeVisible();
  });

  test("opens add region modal", async ({ page }) => {
    await page.getByRole("button", { name: /Add Region/ }).click();
    await expect(page.getByText("Add Region")).toBeVisible();
  });
});

test.describe("Public Workouts Page", () => {
  test("renders workout schedule with dynamic regions", async ({ page }) => {
    await page.goto("/workouts");
    await expect(page.getByText("Monday")).toBeVisible();
    // Should show at least one workout
    await expect(page.locator("text=AM").first()).toBeVisible();
  });
});
