import { test, expect } from "@playwright/test";

test.describe("Backblasts page (redesign)", () => {
  test("header + list render", async ({ page }) => {
    await page.goto("/backblasts");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/From the/i);
    await expect(page.getByText(/Filter by AO/i)).toBeVisible();
  });

  test("AO filter chip set renders", async ({ page }) => {
    await page.goto("/backblasts");
    await expect(page.getByRole("link", { name: /^All$/ })).toBeVisible();
  });

  test("pagination navigates", async ({ page }) => {
    await page.goto("/backblasts");
    const older = page.getByRole("link", { name: /Older →/ });
    if (await older.count()) {
      await older.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });
});
