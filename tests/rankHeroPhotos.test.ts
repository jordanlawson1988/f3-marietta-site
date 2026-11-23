import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  rankHeroPhotos,
  pickHeroPhoto,
  formatHeroStamp,
  HERO_MIN_PAX,
  type HeroPhotoRow,
  type HeroPhoto,
} from "../src/lib/backblast/rankHeroPhotos";

function row(
  id: string,
  opts: { date?: string | null; ao?: string; pax?: string[]; url?: string | null },
): HeroPhotoRow {
  const pax = opts.pax ?? [];
  const url = opts.url === undefined ? `https://storage.googleapis.com/x/${id}.png` : opts.url;
  return {
    id,
    event_date: opts.date === undefined ? "2026-08-11" : opts.date,
    ao_display_name: opts.ao ?? "The Battlefield",
    content_text: pax.length ? `Backblast\nPAX: ${pax.join(", ")}\nQ: someone` : "Backblast with no pax line",
    content_json: url ? { blocks: [{ type: "image", image_url: url }] } : { blocks: [] },
  };
}

const names = (n: number, prefix = "pax") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

test("ranks photos by PAX count, biggest group first", () => {
  const out = rankHeroPhotos([
    row("small", { pax: names(7) }),
    row("big", { pax: names(14) }),
    row("mid", { pax: names(10) }),
  ]);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["big.png", "mid.png", "small.png"]);
  assert.equal(out[0].paxCount, 14);
});

test("breaks PAX ties by newest event date", () => {
  const out = rankHeroPhotos([
    row("older", { pax: names(9), date: "2026-06-25" }),
    row("newer", { pax: names(9), date: "2026-08-20" }),
  ]);
  assert.deepEqual(out.map((p) => p.eventDate), ["2026-08-20", "2026-06-25"]);
});

test("counts Slack IDs and nicknames on the PAX line as one roster", () => {
  const out = rankHeroPhotos([
    row("mixed", { pax: ["@U01AAAAAAA @U02BBBBBBB", "Bill Nye", "Nacho", "Nessie", "Fred", "Ethel", "Lucy"] }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].paxCount, 8);
});

test("skips backblasts that have no photo", () => {
  const out = rankHeroPhotos([
    row("nophoto", { pax: names(14), url: null }),
    row("photo", { pax: names(8) }),
  ]);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["photo.png"]);
});

test("skips groups below the minimum PAX threshold", () => {
  assert.equal(HERO_MIN_PAX, 6);
  const out = rankHeroPhotos([
    row("selfie", { pax: names(2) }),
    row("edge", { pax: names(HERO_MIN_PAX) }),
    row("under", { pax: names(HERO_MIN_PAX - 1) }),
  ]);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["edge.png"]);
});

test("dedupes repeated photo URLs, keeping the higher-ranked backblast", () => {
  const shared = "https://storage.googleapis.com/x/shared.png";
  const out = rankHeroPhotos([
    row("a", { pax: names(8), url: shared }),
    row("b", { pax: names(12), url: shared }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].paxCount, 12);
});

test("honors the limit option", () => {
  const rows = names(20, "id").map((id, i) => row(id, { pax: names(6 + i) }));
  assert.equal(rankHeroPhotos(rows, { limit: 5 }).length, 5);
});

test("carries AO name and event date onto each hero photo", () => {
  const [p] = rankHeroPhotos([row("k", { pax: names(12), ao: "Kenmo", date: "2026-08-05" })]);
  assert.equal(p.aoName, "Kenmo");
  assert.equal(p.eventDate, "2026-08-05");
});

test("pickHeroPhoto wraps slots around the ranked list and is empty-safe", () => {
  const photos: HeroPhoto[] = rankHeroPhotos([
    row("a", { pax: names(14) }),
    row("b", { pax: names(10) }),
    row("c", { pax: names(8) }),
  ]);
  assert.equal(pickHeroPhoto(photos, 0)?.url.split("/").pop(), "a.png");
  assert.equal(pickHeroPhoto(photos, 2)?.url.split("/").pop(), "c.png");
  assert.equal(pickHeroPhoto(photos, 3)?.url.split("/").pop(), "a.png");
  assert.equal(pickHeroPhoto([], 0), null);
});

test("formatHeroStamp reads AO · MM.DD.YY · N PAX and tolerates missing parts", () => {
  assert.equal(
    formatHeroStamp({ url: "u", aoName: "The Battlefield", eventDate: "2026-08-11", paxCount: 14 }),
    "The Battlefield · 08.11.26 · 14 PAX",
  );
  assert.equal(
    formatHeroStamp({ url: "u", aoName: null, eventDate: null, paxCount: 9 }),
    "9 PAX",
  );
});
