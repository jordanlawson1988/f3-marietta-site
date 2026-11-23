import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  selectHeroPhotos,
  HERO_MIN_LUMA,
  type HeroPhotoProbe,
} from "../src/lib/backblast/selectHeroPhotos";
import type { HeroPhoto } from "../src/lib/backblast/rankHeroPhotos";

function photo(id: string, paxCount = 10): HeroPhoto {
  return { url: `https://storage.googleapis.com/x/${id}.png`, aoName: "Kenmo", eventDate: "2026-08-05", paxCount };
}

/** Fake probe keyed by the file name; missing key = probe failure (null). */
function probeFrom(table: Record<string, HeroPhotoProbe | null>) {
  const calls: string[] = [];
  const probe = async (url: string) => {
    const key = url.split("/").pop()!.replace(".png", "");
    calls.push(key);
    return table[key] ?? null;
  };
  return { probe, calls };
}

const bright = { width: 1024, height: 768, luma: 120 };

test("keeps bright landscape photos in rank order", async () => {
  const { probe } = probeFrom({ a: bright, b: bright, c: bright });
  const out = await selectHeroPhotos([photo("a"), photo("b"), photo("c")], probe);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["a.png", "b.png", "c.png"]);
});

test("drops photos darker than HERO_MIN_LUMA", async () => {
  assert.equal(HERO_MIN_LUMA, 55);
  const { probe } = probeFrom({
    gloom: { width: 1024, height: 768, luma: HERO_MIN_LUMA - 1 },
    edge: { width: 1024, height: 768, luma: HERO_MIN_LUMA },
  });
  const out = await selectHeroPhotos([photo("gloom"), photo("edge")], probe);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["edge.png"]);
});

test("drops portrait photos, which crop the men out of a wide hero", async () => {
  const { probe } = probeFrom({
    tall: { width: 768, height: 1024, luma: 120 },
    wide: bright,
  });
  const out = await selectHeroPhotos([photo("tall"), photo("wide")], probe);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["wide.png"]);
});

test("skips a photo whose probe fails instead of failing the whole set", async () => {
  const { probe } = probeFrom({ ok: bright });
  const out = await selectHeroPhotos([photo("broken"), photo("ok")], probe);
  assert.deepEqual(out.map((p) => p.url.split("/").pop()), ["ok.png"]);
});

test("stops probing once the limit is filled", async () => {
  const table: Record<string, HeroPhotoProbe> = {};
  const candidates: HeroPhoto[] = [];
  for (let i = 0; i < 30; i++) {
    table[`p${i}`] = bright;
    candidates.push(photo(`p${i}`));
  }
  const { probe, calls } = probeFrom(table);
  const out = await selectHeroPhotos(candidates, probe, { limit: 4 });
  assert.equal(out.length, 4);
  assert.ok(calls.length < 30, `probed ${calls.length} of 30 candidates`);
});
