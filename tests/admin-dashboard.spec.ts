import { test, expect, type Page } from "@playwright/test";

// Admin credentials — set ADMIN_EMAIL + ADMIN_PASSWORD in .env.local to run these tests.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const hasAdminCreds = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

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

test.describe("admin dashboard", () => {
  test("renders KPI tiles, pie chart, bar chart", async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
    // loginAdmin already navigates to /admin and waits until the post-auth
    // nav is visible. We are already on the dashboard — no second goto needed.

    // --- HERO ---
    await expect(page.getByRole("heading", { name: /Region Ops\./i })).toBeVisible();

    // --- KPI TILES ---
    for (const tag of ["// total posts ytd", "// new fngs ytd", "// unique pax ytd"]) {
      const tile = page.locator("div", { hasText: tag }).first();
      await expect(tile).toBeVisible();
      // Accepts any non-negative integer (including 0 for empty DB)
      await expect(tile).toContainText(/\d+/);
    }

    // --- PIE CHART ---
    // PostsByAoChart renders an SVG with role="img" when there is data, or a heading "By AO"
    // when the DB is empty. Either way the "// posts by ao" MonoTag is always present.
    const pieSection = page.locator("div", { hasText: "// posts by ao" }).first();
    await expect(pieSection).toBeVisible();

    // --- BAR CHART ---
    // TopPaxChart always renders an h3 "Top PAX" regardless of data presence.
    await expect(page.getByRole("heading", { name: /Top PAX/i })).toBeVisible();
  });

  test("KPI tiles drill into /admin/analytics", async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);

    // Each KPI tile is wrapped in a Link → analytics view.
    const totalPostsLink = page.getByRole("link", {
      name: /Drill into total posts/i,
    });
    await expect(totalPostsLink).toBeVisible();
    await expect(totalPostsLink).toHaveAttribute("href", "/admin/analytics");

    const fngsLink = page.getByRole("link", {
      name: /Drill into new FNGs/i,
    });
    await expect(fngsLink).toHaveAttribute("href", "/admin/analytics");

    const paxLink = page.getByRole("link", {
      name: /Drill into the full PAX leaderboard/i,
    });
    await expect(paxLink).toHaveAttribute("href", "/admin/analytics?topN=all");
  });

  test("admin nav surfaces Analytics link", async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
    const analyticsLink = page.locator("nav").getByRole("link", {
      name: "Analytics",
    });
    await expect(analyticsLink).toBeVisible();
    await expect(analyticsLink).toHaveAttribute("href", "/admin/analytics");
  });
});
