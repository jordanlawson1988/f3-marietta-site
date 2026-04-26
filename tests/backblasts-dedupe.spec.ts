import { test, expect } from "@playwright/test";

/**
 * Slackblast occasionally creates two f3_events rows for the same workout
 * (Q hits "New Backblast" twice instead of "Edit"). The /backblasts listing
 * must dedupe by (channel, AO, date, kind) and surface only the freshest
 * row per workout. NULL-date rows are NOT deduped — those are different
 * workouts that lost their parsed date.
 */
test.describe("/backblasts — duplicate suppression", () => {
  test("no two cards share the same AO + date combination", async ({ page }) => {
    await page.goto("/backblasts");
    // Give server-rendered list time to settle.
    await page.waitForLoadState("networkidle");

    // Each card has a date label (e.g. "APR 22, 2026") and an AO badge
    // (e.g. "BLACK OPS"). Pull both per card and verify uniqueness for
    // cards where date is parseable (skip "NO DATE" / undated rows).
    const cards = page.locator('a[href^="/backblasts/"]').filter({
      // Detail-page links live on each card; filter to ones that include
      // a date span so we only look at full backblast cards, not nav.
      has: page.locator("text=/[A-Z]{3}\\s\\d{1,2},\\s\\d{4}/"),
    });

    const seen = new Set<string>();
    const dupes: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const text = (await card.innerText()).trim();
      const dateMatch = text.match(/([A-Z]{3}\s\d{1,2},\s\d{4})/);
      if (!dateMatch) continue;
      // First line of the card text is the AO badge for these cards.
      const ao = text.split("\n")[0].trim();
      const key = `${ao}|${dateMatch[1]}`;
      if (seen.has(key)) dupes.push(key);
      seen.add(key);
    }

    expect(
      dupes,
      `found duplicate (AO, date) backblast cards: ${dupes.join(", ")}`,
    ).toEqual([]);
  });
});
