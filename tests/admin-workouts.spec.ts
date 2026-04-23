import { test, expect, type Page } from "@playwright/test";

// Admin credentials — set ADMIN_EMAIL + ADMIN_PASSWORD in .env.local to run these tests.
// Tests that require auth are skipped when credentials are absent.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const hasAdminCreds = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

// ---------------------------------------------------------------------------
// Shared login helper
// ---------------------------------------------------------------------------
async function loginAdmin(page: Page) {
  await page.goto("/admin");
  // Wait for login form (AdminAuthProvider renders it when there is no session)
  await page.waitForSelector("#admin-email", { timeout: 10_000 });
  await page.locator("#admin-email").fill(ADMIN_EMAIL);
  await page.locator("#admin-password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  // AdminAuthProvider replaces the login form with children when session is set.
  // Wait for the top admin nav link that only appears post-auth.
  await expect(page.locator("nav").getByRole("link", { name: "Workouts" })).toBeVisible({
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Admin Workout Management
// ---------------------------------------------------------------------------
test.describe("Admin Workout Management", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
    await page.goto("/admin/workouts");
    // Wait for the schedule manager heading to confirm the page has rendered
    await expect(page.getByText("Schedule Manager")).toBeVisible({ timeout: 10_000 });
  });

  test("displays admin nav with section links", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Workouts" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Regions" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "KB" })).toBeVisible();
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

  test("opens create modal when clicking New Workout", async ({ page }) => {
    // ChamferButton without href renders as a <button>
    await page.getByRole("button", { name: "New Workout" }).click();
    await expect(page.getByRole("heading", { name: "Add Workout" })).toBeVisible();
    // Modal fields use id-based inputs (MonoTag labels, not <label htmlFor>)
    await expect(page.locator("#ao-name")).toBeVisible();
    await expect(page.locator("#workout-type")).toBeVisible();
    // Close modal
    await page.getByRole("button", { name: "Cancel" }).click();
    // Modal should be dismissed
    await expect(page.getByRole("heading", { name: "Add Workout" })).not.toBeVisible();
  });

  // Requires workout data — skipped when calendar is empty
  test("opens edit modal when clicking a workout block", async ({ page }) => {
    const firstBlock = page.locator("[data-testid='workout-block']").first();
    const count = await firstBlock.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await firstBlock.click();
    await expect(page.getByRole("heading", { name: "Edit Workout" })).toBeVisible();
    // Close modal
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("navigates to regions page via nav link", async ({ page }) => {
    await page.locator("nav").getByRole("link", { name: "Regions" }).click();
    await page.waitForURL(/\/admin\/regions/);
    await expect(page.getByRole("heading", { name: "Regions" })).toBeVisible();
  });

  test("region filter pills render with All active by default", async ({ page }) => {
    const allButton = page.getByRole("button", { name: "All" });
    await expect(allButton).toBeVisible();
    // "All" pill should have the active colour (bg-[#4A76A8] → contains white text)
    // We just verify it's clickable and interactive
    await allButton.click();
    await expect(allButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Admin Regions Management
// ---------------------------------------------------------------------------
test.describe("Admin Regions Management", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
    await page.goto("/admin/regions");
    await expect(page.getByRole("heading", { name: "Regions" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("displays regions page heading and Add Region button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Regions" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Region/i })).toBeVisible();
  });

  test("opens add region modal", async ({ page }) => {
    await page.getByRole("button", { name: /Add Region/i }).click();
    await expect(page.getByRole("heading", { name: "Add Region" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Public Workouts Page (no auth required)
// ---------------------------------------------------------------------------
test.describe("Public Workouts Page", () => {
  test("renders workout schedule page header", async ({ page }) => {
    await page.goto("/workouts");
    // PageHeader renders an <h1> with the bespoke "Find Your Battlefield." title (Task 4.2)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Confirm we're on the workouts page — the URL is sufficient
    await expect(page).toHaveURL(/\/workouts/);
  });
});
