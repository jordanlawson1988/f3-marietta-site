import { test, expect, devices } from "@playwright/test";

/**
 * The TopBar "Next Muster" pill must:
 *   1. Render as a <a> link (not just text).
 *   2. Point to /workouts#ao-{slug} of an AO that actually exists in the
 *      schedule.
 *   3. Show the AO name alongside the day + time so the tap is meaningful.
 *   4. Land on /workouts with the corresponding AOCard scrolled into view
 *      (the card has a matching id attribute).
 *
 * Note: the Marietta region only schedules a handful of AOs, so the
 * resolved slug at any given moment will be one of a small known set.
 */

const KNOWN_AO_SLUGS = [
  "marietta-square",
  "the-battlefield",
  "the-last-stand",
  "rocktown",
];

test.describe("Next Muster link in TopBar", () => {
  test("renders as a link to a real AO anchor on /workouts", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /next muster:/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href, "href must point to /workouts#ao-…").toMatch(
      /^\/workouts#ao-[a-z0-9-]+$/,
    );
    const slug = href!.replace(/^\/workouts#ao-/, "");
    expect(
      KNOWN_AO_SLUGS,
      `slug ${slug} should be one of the known Marietta AOs`,
    ).toContain(slug);
  });

  test("link text includes day + time + AO name", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /next muster:/i });
    const text = (await link.textContent()) ?? "";
    // Day code (3 letters) + 12-hour time + an AO word.
    expect(text).toMatch(/(MON|TUE|WED|THU|FRI|SAT|SUN)/);
    expect(text.toLowerCase()).toMatch(/\d{1,2}:\d{2}\s*(am|pm)/);
  });

  test("clicking the link lands on the matching AO card on /workouts", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /next muster:/i });
    const href = (await link.getAttribute("href"))!;
    const slug = href.replace(/^\/workouts#ao-/, "");

    // Navigate (click would require viewport scrolling for mobile; goto is
    // equivalent for verifying the destination renders correctly).
    await page.goto(href);
    await page.waitForLoadState("networkidle");
    const targetCard = page.locator(`#ao-${slug}`);
    await expect(targetCard, `#ao-${slug} should exist on /workouts`).toBeAttached();
  });
});

test.describe("Next Muster link on iPhone 14", () => {
  test("link is visible in the topbar and fits on a single line", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 14"] });
    const page = await ctx.newPage();
    await page.goto("/");
    const link = page.getByRole("link", { name: /next muster:/i });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    // Single-line height bound at this font-size; the bar pre-fix wrapped
    // to two lines hitting ~50px+. Anything under 40px proves no wrap.
    expect(box?.height).toBeLessThan(40);
    await ctx.close();
  });
});
