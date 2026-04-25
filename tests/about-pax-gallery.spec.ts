import { test, expect } from "@playwright/test";

/**
 * About page now embeds two photo galleries that surface real Slack-posted
 * backblast photos. Both are designed to be invisible (return null) when
 * the database doesn't yet have enough real photos to render honestly,
 * so these tests assert on conditional structure: when present, structure
 * is correct; either way, page core never breaks.
 */
test.describe("About page — PAX photo galleries", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about");
  });

  test("page core renders regardless of photo availability", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: /men\.\s*marietta/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /plant\.\s*grow\.\s*serve\./i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /a short history/i })
    ).toBeVisible();
  });

  test("section numbering is monotonic when the brotherhood gallery renders", async ({ page }) => {
    // The eyebrow markers on the page should still read § 01, then § 03 if
    // the brotherhood gallery is hidden, OR § 01 → § 02 → § 03 if visible.
    const brotherhood = page.getByTestId("about-brotherhood-gallery");
    if (await brotherhood.isVisible().catch(() => false)) {
      await expect(brotherhood.getByText(/§ 02 · The Brotherhood/i)).toBeVisible();
      await expect(page.getByText(/§ 03 · The Record/i)).toBeVisible();
    } else {
      // Hidden gallery — record should still read as § 03 (page renumbers
      // statically regardless of gallery presence so visitors don't see
      // gaps).
      await expect(page.getByText(/§ 03 · The Record/i)).toBeVisible();
    }
  });

  test("PaxMosaic, when rendered, contains real Slack photos with alt text", async ({ page }) => {
    const mosaic = page.getByTestId("about-pax-mosaic");
    const visible = await mosaic.isVisible().catch(() => false);
    test.skip(!visible, "No backblast photos in DB yet — mosaic correctly hidden");

    const figures = mosaic.locator("figure");
    const count = await figures.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(6);

    // Every photo must have alt text (a11y).
    const images = mosaic.locator("img");
    const imageCount = await images.count();
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt, `image ${i} missing alt`).toBeTruthy();
      expect(alt!.length).toBeGreaterThan(0);
    }
  });

  test("BrotherhoodGallery, when rendered, has exactly 3 photos with alt text", async ({ page }) => {
    const gallery = page.getByTestId("about-brotherhood-gallery");
    const visible = await gallery.isVisible().catch(() => false);
    test.skip(!visible, "Not enough backblast photos in DB yet — gallery correctly hidden");

    const figures = gallery.locator("figure");
    await expect(figures).toHaveCount(3);

    const images = gallery.locator("img");
    const imageCount = await images.count();
    expect(imageCount).toBe(3);
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt, `image ${i} missing alt`).toBeTruthy();
    }

    // Closing CTA points back to the backblasts archive.
    await expect(
      gallery.getByRole("link", { name: /see every backblast/i })
    ).toBeVisible();
  });
});
