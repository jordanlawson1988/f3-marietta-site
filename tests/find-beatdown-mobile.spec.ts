import { test, expect, devices } from "@playwright/test";

/**
 * "Find Your Beatdown" home section had two mobile defects:
 *   1. The kicker hardcoded "07:00 on Saturdays" — but the data has no
 *      07:00 workouts (Saturdays run 06:00 / 06:30). It now derives times
 *      from the schedule, so the test asserts no stale "07:00" string.
 *   2. The card grid used minmax(320px, 1fr). On 320–375px viewports
 *      (iPhone SE / 12 Mini) the grid container was narrower than 320px,
 *      so each card overflowed horizontally and the right edge of every
 *      card (status chip + Directions link) was clipped behind
 *      body { overflow-x: hidden }. Now uses minmax(260px, 1fr) so
 *      cards fit cleanly even on the smallest current iPhone.
 */

const PHONES = ["iPhone SE", "iPhone 14"] as const;

for (const phoneName of PHONES) {
  test(`Find Your Beatdown on ${phoneName}: kicker copy reflects real workout times`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ ...devices[phoneName] });
    const page = await ctx.newPage();
    await page.goto("/");
    const section = page.locator("section#workouts");
    await expect(section).toBeAttached();
    // Pull the SectionHead kicker — the eyebrow + heading siblings live
    // inside a div under the heading. The simplest robust read is the
    // full text content of the section header area before the filter row.
    const headBlock = section.locator(":scope > div > :first-child");
    const kicker = (await headBlock.textContent()) ?? "";
    // Used to claim Saturdays at 07:00 — that workout doesn't exist.
    expect(kicker).not.toMatch(/07:00/);
    expect(kicker).not.toMatch(/\b7am\b/i);
    expect(kicker).not.toMatch(/\b7:00\s*am\b/i);
    // References the real times.
    expect(kicker).toMatch(/(05:30|5:30am|5:15am)/);
    expect(kicker).toMatch(/(06:00|6:00am)/);
    await ctx.close();
  });

  test(`Find Your Beatdown on ${phoneName}: cards do not overflow horizontally`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ ...devices[phoneName] });
    const page = await ctx.newPage();
    await page.goto("/");
    const section = page.locator("section#workouts");
    await section.scrollIntoViewIfNeeded();
    await page.addStyleTag({
      content: `.reveal { opacity: 1 !important; transform: none !important; }`,
    });
    await page.waitForTimeout(400);

    const stats = await page.evaluate(() => {
      const sec = document.querySelector("section#workouts")!;
      const cards = sec.querySelectorAll("article");
      const grids = Array.from(sec.querySelectorAll<HTMLElement>(".grid"));
      const cardGrid = grids.find((g) => g.querySelector("article"));
      if (!cardGrid || cards.length === 0) return null;
      return {
        gridWidth: cardGrid.getBoundingClientRect().width,
        firstCardWidth: cards[0].getBoundingClientRect().width,
        cardCount: cards.length,
      };
    });
    expect(stats, "section did not render any cards").not.toBeNull();
    expect(stats!.cardCount).toBeGreaterThan(0);
    // No overflow: a card's painted width must fit inside its grid container.
    expect(stats!.firstCardWidth).toBeLessThanOrEqual(stats!.gridWidth + 1);
    await ctx.close();
  });

  test(`Find Your Beatdown on ${phoneName}: Sat filter surfaces Marietta Square at 6:00am`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ ...devices[phoneName] });
    const page = await ctx.newPage();
    await page.goto("/");
    const section = page.locator("section#workouts");
    await section.scrollIntoViewIfNeeded();
    await page.click('section#workouts button:has-text("Sat")');
    await page.waitForTimeout(300);
    const marietta = section.locator('article:has-text("Marietta Square")');
    await expect(marietta).toBeVisible();
    // Real start_time is 06:00:00 → "6:00am" via AOCard.formatTime.
    await expect(marietta).toContainText("6:00am");
    await ctx.close();
  });
}
