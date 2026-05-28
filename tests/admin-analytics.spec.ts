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

test.describe("Admin BI Analytics", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAdminCreds) test.skip();
    await loginAdmin(page);
  });

  test("overview renders KPI tiles, trend, heatmap, and Q leaderboard", async ({ page }) => {
    await page.goto("/admin/analytics");
    // KPI tile labels — rendered as MonoTag "// label" inside KpiTile
    await expect(page.getByText("// total posts")).toBeVisible();
    await expect(page.getByText("// unique pax")).toBeVisible();
    await expect(page.getByText("// new fngs")).toBeVisible();
    await expect(page.getByText("// avg headcount")).toBeVisible();
    // Trend chart eyebrow
    await expect(page.getByText("// posts over time · monthly").first()).toBeVisible();
    // Day × time heatmap eyebrow
    await expect(page.getByText("// day × time").first()).toBeVisible();
    // Q leaderboard eyebrow (new section)
    await expect(page.getByText("// q leaderboard · in range").first()).toBeVisible();
    // AO leaderboard eyebrow (new section, replaces old pie chart)
    await expect(page.getByText("// ao leaderboard · in range").first()).toBeVisible();
  });

  test("filter change updates URL and re-renders", async ({ page }) => {
    await page.goto("/admin/analytics");
    // FilterBar button uses TIME_RANGE_LABELS["last-30"] = "Last 30d"
    await page.getByRole("button", { name: "Last 30d" }).click();
    await expect(page).toHaveURL(/range=last-30/);
    await expect(
      page.getByRole("button", { name: "Last 30d" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("AO drill-down navigates correctly", async ({ page }) => {
    await page.goto("/admin/analytics");
    // AoLeaderboardTable wraps each row in <Link href={aoHref(slug)}>
    const firstAoLink = page
      .locator('a[href*="/admin/analytics/ao/"]')
      .first();
    await firstAoLink.click();
    await expect(page).toHaveURL(/\/admin\/analytics\/ao\//);
    // AO detail page has KPI tiles too
    await expect(page.getByText("// total posts")).toBeVisible({ timeout: 15_000 });
  });

  test("PAX drill-down navigates correctly", async ({ page }) => {
    await page.goto("/admin/analytics");
    // PaxLeaderboardTable wraps each row in <Link href={paxHref(key)}>
    const firstPaxLink = page
      .locator('a[href*="/admin/analytics/pax/"]')
      .first();
    await firstPaxLink.click();
    await expect(page).toHaveURL(/\/admin\/analytics\/pax\//);
    await expect(page.getByText("// longest streak")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("drill-down preserves time range", async ({ page }) => {
    await page.goto("/admin/analytics?range=last-30");
    const firstAoLink = page
      .locator('a[href*="/admin/analytics/ao/"]')
      .first();
    const href = await firstAoLink.getAttribute("href");
    expect(href).toMatch(/range=last-30/);
    await firstAoLink.click();
    await expect(page).toHaveURL(/range=last-30/);
  });

  test("CSV export triggers download", async ({ page }) => {
    await page.goto("/admin/analytics");
    const downloadPromise = page.waitForEvent("download");
    // ExportButton renders as a plain <a> tag with the label text
    await page.getByRole("link", { name: "Overview CSV" }).click();
    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(/^f3-analytics-overview.*\.csv$/);
  });

  test("invalid range redirects to default", async ({ page }) => {
    await page.goto("/admin/analytics?range=banana");
    // parseTimeRange returns null for unknown slugs; page.tsx redirects to /admin/analytics
    await expect(page).toHaveURL(/\/admin\/analytics$/);
  });

  test("unknown AO slug returns not-found UI", async ({ page }) => {
    // In Next.js dev mode, notFound() renders a 200 with not-found UI.
    // We assert on the visible content instead of the HTTP status code.
    const response = await page.goto(
      "/admin/analytics/ao/this-ao-does-not-exist-at-all"
    );
    // Try status check first; fall back to content check (Next 15 RSC dev behaviour)
    const status = response?.status() ?? 0;
    if (status === 404) {
      expect(status).toBe(404);
    } else {
      // Dev mode returns 200 with the not-found boundary UI
      await expect(
        page.locator("body").filter({ hasText: /not.found|404|page could not be found/i })
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("empty range shows zeroes, not error", async ({ page }) => {
    // Custom range well in the past — region had no data in Jan 2025.
    // parseTimeRange accepts any past range as long as to <= today and
    // to <= from + 2 years (both conditions satisfied here).
    await page.goto(
      "/admin/analytics?range=custom&from=2025-01-01&to=2025-01-02"
    );
    await expect(page.getByText("// total posts")).toBeVisible();
    // The MetricCard value for total posts should be "0"
    // MonoTag renders "// total posts"; sibling <p> holds the numeric value.
    const card = page.locator("text=// total posts").locator("..");
    await expect(card).toContainText("0");
  });
});
