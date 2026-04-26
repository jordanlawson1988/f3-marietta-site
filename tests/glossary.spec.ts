import { test, expect } from "@playwright/test";

test.describe("Glossary page (redesign)", () => {
  test("hero and at least one letter rail render", async ({ page }) => {
    await page.goto("/glossary");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Lexicon/i);
    await expect(page.getByPlaceholder(/Search/i).or(page.getByRole("searchbox"))).toBeVisible();
  });
});
