import { test, expect } from "@playwright/test";

/**
 * Hero surfaces across the site show real backblast photos ranked by PAX
 * count (biggest group first) instead of the newest post. Photos come from
 * the Slackblast GCS bucket; next/image keeps the host inside the optimized
 * URL, so `src*="storage.googleapis.com"` identifies a real photo.
 *
 * Like the About gallery spec, these tests tolerate an empty database (env-less
 * CI) by asserting structure when a photo is present and page core otherwise.
 */
const PHOTO = 'img[src*="storage.googleapis.com"]';

test.describe("Hero PAX photos", () => {
  test("home hero renders the top-ranked group photo with a PAX stamp", async ({ page }) => {
    await page.goto("/");
    const hero = page.getByTestId("home-hero");
    await expect(hero).toBeVisible();
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();

    const photo = hero.locator(PHOTO).first();
    if (await photo.count()) {
      await expect(photo).toBeAttached();
      await expect(hero.getByTestId("hero-stamp")).toContainText(/\d+ PAX/);
    }
  });

  test("page headers carry a hero photo and do not repeat the home photo", async ({ page }) => {
    await page.goto("/");
    // count() first: getAttribute() on a missing element would wait out the
    // whole test timeout in an env-less CI run with no photos.
    const homePhoto = page.getByTestId("home-hero").locator(PHOTO).first();
    const homeSrc = (await homePhoto.count()) ? await homePhoto.getAttribute("src") : null;

    await page.goto("/about");
    const header = page.getByTestId("page-header");
    await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
    const aboutPhoto = header.locator(PHOTO).first();
    if (homeSrc && (await aboutPhoto.count())) {
      expect(await aboutPhoto.getAttribute("src")).not.toBe(homeSrc);
      await expect(header.getByTestId("hero-stamp")).toContainText(/\d+ PAX/);
    }
  });

  test("formerly static pages still render with a hero header", async ({ page }) => {
    for (const path of ["/faq", "/contact", "/glossary", "/fng"]) {
      await page.goto(path);
      const header = page.getByTestId("page-header");
      await expect(header).toBeVisible();
      await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});
