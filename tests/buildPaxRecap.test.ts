import { test, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildPaxRecapUrl,
  buildRecapMessage,
  buildRecapSample,
  formatRecapMonth,
  getSiteBaseUrl,
} from "../src/lib/stats/buildPaxRecap";
import type { PaxRecapRow } from "../src/lib/stats/getMonthlyPaxRecap";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV;
  }
});

// --- URL builder ---

test("URL defaults to the prod domain when NEXT_PUBLIC_SITE_URL is unset", () => {
  assert.equal(
    buildPaxRecapUrl("mr-clean"),
    "https://www.f3marietta.com/stats/pax/mr-clean?range=last-month",
  );
});

test("URL respects NEXT_PUBLIC_SITE_URL when present", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert.equal(
    buildPaxRecapUrl("mr-clean"),
    "http://localhost:3000/stats/pax/mr-clean?range=last-month",
  );
});

test("URL strips trailing slashes from the base", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com///";
  assert.equal(
    buildPaxRecapUrl("backfist"),
    "https://staging.example.com/stats/pax/backfist?range=last-month",
  );
});

test("URL explicit baseUrl arg overrides env", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://env.example.com";
  assert.equal(
    buildPaxRecapUrl("milton", "https://override.example.com"),
    "https://override.example.com/stats/pax/milton?range=last-month",
  );
});

test("getSiteBaseUrl falls back when env is empty string", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "  ";
  assert.equal(getSiteBaseUrl(), "https://www.f3marietta.com");
});

// --- Message builder ---

const SAMPLE: PaxRecapRow = {
  slackUserId: "U001",
  paxLabel: "Mr Clean",
  paxSlug: "mr-clean",
  posts: 8,
  aos: 3,
  qd: 2,
  aoNames: ["The Battlefield", "Galaxy", "Madhouse"],
};

test("message greets the PAX by label and names the month", () => {
  const msg = buildRecapMessage(SAMPLE, "April 2026");
  assert.match(msg, /Hey Mr Clean/);
  assert.match(msg, /April 2026/);
});

test("message includes the deep link with last-month range", () => {
  const msg = buildRecapMessage(SAMPLE, "April 2026");
  assert.match(
    msg,
    /https:\/\/www\.f3marietta\.com\/stats\/pax\/mr-clean\?range=last-month/,
  );
});

test("message pluralizes posts, AOs, and Q'd workouts correctly", () => {
  const oneOfEach = buildRecapMessage(
    { ...SAMPLE, posts: 1, aos: 1, qd: 1, aoNames: ["The Battlefield"] },
    "April 2026",
  );
  assert.match(oneOfEach, /1 post across 1 AO\b/);
  assert.match(oneOfEach, /Q'd 1 workout\b/);

  const many = buildRecapMessage(SAMPLE, "April 2026");
  assert.match(many, /8 posts across 3 AOs/);
  assert.match(many, /Q'd 2 workouts/);
});

test("message omits the Q'd line when qd is 0", () => {
  const msg = buildRecapMessage({ ...SAMPLE, qd: 0 }, "April 2026");
  assert.ok(!/Q'd \d+ workout/.test(msg), "Q'd line should be hidden");
});

test("message lists AOs when there are 1-3, hides the line when 4+", () => {
  const three = buildRecapMessage(SAMPLE, "April 2026");
  assert.match(three, /Where: The Battlefield, Galaxy, Madhouse/);

  const many = buildRecapMessage(
    {
      ...SAMPLE,
      aoNames: ["Galaxy", "Madhouse", "Black Ops", "The Battlefield"],
    },
    "April 2026",
  );
  assert.ok(!/Where: /.test(many), "AO line should be hidden when 4+");
});

test("message ends with the 'Keep showing up' signoff", () => {
  const msg = buildRecapMessage(SAMPLE, "April 2026");
  assert.match(msg, /Keep showing up\. — F3 Marietta$/);
});

// --- Month label ---

// --- Sample builder ---

test("buildRecapSample returns null for an empty recipient list", () => {
  assert.equal(buildRecapSample([], "April 2026"), null);
});

test("buildRecapSample uses the FIRST (highest-posts) recipient as the sample", () => {
  // planMonthlyRecap pre-sorts by posts desc; sample should match that
  // top entry so admins always see the most-active PAX in the preview.
  const recipients: PaxRecapRow[] = [
    {
      slackUserId: "U001",
      paxLabel: "Mr Clean",
      paxSlug: "mr-clean",
      posts: 14,
      aos: 3,
      qd: 4,
      aoNames: ["The Battlefield", "Black Ops", "The Last Stand"],
    },
    {
      slackUserId: "U002",
      paxLabel: "Milton",
      paxSlug: "milton",
      posts: 9,
      aos: 2,
      qd: 2,
      aoNames: ["The Battlefield", "Galaxy"],
    },
  ];
  const sample = buildRecapSample(recipients, "April 2026");
  assert.ok(sample);
  assert.equal(sample.paxLabel, "Mr Clean");
  assert.equal(sample.slackUserId, "U001");
  assert.match(sample.url, /\/stats\/pax\/mr-clean\?range=last-month$/);
  assert.match(sample.messagePreview, /Hey Mr Clean/);
  assert.match(sample.messagePreview, /14 posts across 3 AOs/);
});

test("buildRecapSample honors an explicit baseUrl override", () => {
  const recipients: PaxRecapRow[] = [
    {
      slackUserId: "U001",
      paxLabel: "Mr Clean",
      paxSlug: "mr-clean",
      posts: 1,
      aos: 1,
      qd: 0,
      aoNames: ["The Battlefield"],
    },
  ];
  const sample = buildRecapSample(recipients, "April 2026", "http://localhost:3000");
  assert.ok(sample);
  assert.equal(
    sample.url,
    "http://localhost:3000/stats/pax/mr-clean?range=last-month",
  );
  assert.match(
    sample.messagePreview,
    /http:\/\/localhost:3000\/stats\/pax\/mr-clean\?range=last-month/,
  );
});

test("formatRecapMonth produces 'Month YYYY' from a UTC month-start Date", () => {
  assert.equal(
    formatRecapMonth(new Date(Date.UTC(2026, 3, 1))), // April 2026
    "April 2026",
  );
  assert.equal(
    formatRecapMonth(new Date(Date.UTC(2025, 11, 1))), // December 2025
    "December 2025",
  );
});
