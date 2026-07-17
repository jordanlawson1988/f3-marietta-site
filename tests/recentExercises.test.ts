import { test } from "node:test";
import { strict as assert } from "node:assert";
import { extractRecentExercises } from "../src/lib/beatdown/recentExercises";

const EXICON = [
  { term: "Merkin" },
  { term: "Burpee" },
  { term: "Bear Crawl" },
  { term: "11s" },
  { term: "Monkey Humpers" },
  { term: "AB" }, // too short — must be skipped
];

function ev(date: string | null, text: string) {
  return { event_date: date, content_text: text };
}

test("counts events (not raw mentions) per exicon term, ranked by frequency", () => {
  const events = [
    ev("2026-07-14", "WARMUP: SSH. THANG: 20 Merkins, then more merkins, 10 Burpees."),
    ev("2026-07-10", "Merkin ladder up the hill"),
    ev("2026-07-07", "Bear crawl to the wall, burpee broad jumps"),
  ];
  const stats = extractRecentExercises(events, EXICON);
  const merkin = stats.find((s) => s.term === "Merkin");
  const burpee = stats.find((s) => s.term === "Burpee");
  assert.equal(merkin?.count, 2, "Merkin appears in 2 events (double mention counts once)");
  assert.equal(burpee?.count, 2);
  assert.equal(stats[0].count >= stats[stats.length - 1].count, true, "sorted by count desc");
});

test("matches are case-insensitive, word-bounded, and plural-tolerant", () => {
  const events = [ev("2026-07-14", "100 MERKINS OYO, monkey humpers x20, elevens on the hill")];
  const stats = extractRecentExercises(events, EXICON);
  assert.ok(stats.find((s) => s.term === "Merkin"), "MERKINS matches Merkin");
  assert.ok(stats.find((s) => s.term === "Monkey Humpers"), "multi-word term matches");
  // "elevens" spelled out does NOT match the term "11s" — no fuzzy aliasing.
  assert.equal(stats.find((s) => s.term === "11s"), undefined);
});

test("word boundaries prevent substring false positives", () => {
  const events = [ev("2026-07-14", "We admired the burpeetastic sunrise")];
  const stats = extractRecentExercises(events, EXICON);
  assert.equal(stats.find((s) => s.term === "Burpee"), undefined);
});

test("lastUsed is the most recent event_date mentioning the term", () => {
  const events = [
    ev("2026-07-14", "Burpees"),
    ev("2026-07-01", "Burpees again"),
    ev(null, "Burpees with no date"),
  ];
  const stats = extractRecentExercises(events, EXICON);
  assert.equal(stats.find((s) => s.term === "Burpee")?.lastUsed, "2026-07-14");
  assert.equal(stats.find((s) => s.term === "Burpee")?.count, 3);
});

test("terms shorter than 3 chars are skipped; max cap respected", () => {
  const events = [ev("2026-07-14", "AB workout: Merkins, Burpees, Bear Crawls, Monkey Humpers")];
  const stats = extractRecentExercises(events, EXICON, { max: 2 });
  assert.equal(stats.length, 2);
  assert.equal(stats.find((s) => s.term === "AB"), undefined);
});

test("empty inputs return empty list", () => {
  assert.deepEqual(extractRecentExercises([], EXICON), []);
  assert.deepEqual(extractRecentExercises([ev("2026-07-14", "chatter")], []), []);
});
