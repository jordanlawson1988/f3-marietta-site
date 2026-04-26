import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/about", title: /Men\. Marietta\./i },
  { path: "/workouts", title: /Find Your/i },
  { path: "/backblasts", title: /From the/i },
  { path: "/new-here", title: /Your First/i },
  { path: "/contact", title: /Find us\./i },
  { path: "/fng", title: /Friendly/i },
  { path: "/glossary", title: /Lexicon/i },
  { path: "/community", title: /Fellowship/i },
  { path: "/what-to-expect", title: /First/i },
];

test.describe("Public sub-pages smoke", () => {
  for (const { path, title } of PAGES) {
    test(`${path} renders with its hero title`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
      await expect(page.getByText(/A Region of F3 Nation/i)).toBeVisible();
    });
  }
});
