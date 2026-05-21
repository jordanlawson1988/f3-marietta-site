import { test, expect, type Page } from "@playwright/test";

// Admin credentials — set ADMIN_EMAIL + ADMIN_PASSWORD in .env.local to run these tests.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const hasAdminCreds = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

// A throwaway channel ID that looks valid but won't conflict with real channels.
const TEST_CHANNEL_ID = "C0TEST9999";
const TEST_DISPLAY_NAME = `Test AO ${Date.now()}`;

async function loginAdmin(page: Page) {
  await page.goto("/admin");
  await page.waitForSelector("#admin-email", { timeout: 10_000 });
  await page.locator("#admin-email").fill(ADMIN_EMAIL);
  await page.locator("#admin-password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(
    page.locator("nav").getByRole("link", { name: "Workouts" })
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Admin AO Channels", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
  });

  test("page loads with table and Sync button", async ({ page }) => {
    await page.goto("/admin/ao-channels");
    await expect(page.getByText("AO Channel Manager")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Sync from Slack/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Channel" })).toBeVisible();
  });

  test("add a channel → appears in table → toggle disable → delete", async ({ page }) => {
    await page.goto("/admin/ao-channels");

    // Open the create drawer
    await page.getByRole("button", { name: "New Channel" }).click();
    await expect(page.getByText("Add AO Channel")).toBeVisible({ timeout: 5_000 });

    // Fill in the form
    await page.locator("input[placeholder='e.g. C0A4LQHJUDD']").fill(TEST_CHANNEL_ID);
    await page.locator("input[placeholder='e.g. Kenmo']").fill(TEST_DISPLAY_NAME);

    // Submit
    await page.getByRole("button", { name: "Register" }).click();

    // Should close and show the new row
    await expect(page.getByText("Add AO Channel")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(TEST_DISPLAY_NAME)).toBeVisible({ timeout: 10_000 });

    // Open edit drawer for the new row
    const row = page.locator("tr", { hasText: TEST_DISPLAY_NAME });
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Edit AO Channel")).toBeVisible({ timeout: 5_000 });

    // Toggle enabled off
    const toggle = page.locator(".rounded-full.relative.transition-colors.cursor-pointer").first();
    await toggle.click();
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Should now show Disabled status
    await expect(page.getByText("Edit AO Channel")).not.toBeVisible({ timeout: 5_000 });
    await expect(row.getByText("Disabled")).toBeVisible({ timeout: 10_000 });

    // Delete the test channel
    await row.getByRole("button", { name: "Edit" }).click();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();

    // Should be removed from the table
    await expect(page.getByText(TEST_DISPLAY_NAME)).not.toBeVisible({ timeout: 10_000 });
  });

  test("Sync from Slack button shows result summary", async ({ page }) => {
    await page.goto("/admin/ao-channels");
    await page.getByRole("button", { name: /Sync from Slack/i }).click();
    // Button should show "Syncing..." then restore, and a result line should appear
    await expect(page.getByText(/processed/)).toBeVisible({ timeout: 60_000 });
  });

  test("nav link to AO Channels is present", async ({ page }) => {
    await page.goto("/admin");
    await expect(
      page.locator("nav").getByRole("link", { name: "AO Channels" })
    ).toBeVisible();
  });
});
