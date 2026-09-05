import { test } from "node:test";
import { strict as assert } from "node:assert";
import sharp from "sharp";
import { probeHeroPhoto } from "../src/lib/backblast/probeHeroPhoto";

async function fakeFetchOf(buf: Buffer, ok = true) {
  return async () =>
    new Response(new Uint8Array(buf), { status: ok ? 200 : 500 });
}

test("reports dimensions and mean brightness of a fetched image", async () => {
  const grey = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 200, b: 200 } },
  }).png().toBuffer();
  const probe = await probeHeroPhoto("https://example.test/grey.png", await fakeFetchOf(grey));
  assert.ok(probe);
  assert.equal(probe.width, 40);
  assert.equal(probe.height, 30);
  assert.ok(Math.abs(probe.luma - 200) < 1, `luma ${probe.luma}`);
});

test("returns null when the image cannot be fetched", async () => {
  const probe = await probeHeroPhoto("https://example.test/missing.png", await fakeFetchOf(Buffer.alloc(0), false));
  assert.equal(probe, null);
});

test("returns null when the payload is not an image", async () => {
  const probe = await probeHeroPhoto("https://example.test/nope.png", await fakeFetchOf(Buffer.from("not an image")));
  assert.equal(probe, null);
});
