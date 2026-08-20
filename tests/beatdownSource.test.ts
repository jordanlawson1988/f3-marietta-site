import { test } from "node:test";
import { strict as assert } from "node:assert";
import { SOURCE_KINDS, SOURCE_LABELS, normalizeSource } from "../src/lib/beatdown/source";
import { BEATDOWN_SYSTEM_INSTRUCTION } from "../src/lib/beatdown/prompts/system";

test("vocabulary contract: every source kind has a label", () => {
  for (const kind of SOURCE_KINDS) {
    assert.ok(SOURCE_LABELS[kind], `no label for source kind "${kind}"`);
  }
});

test("vocabulary contract: label map declares no kind the union does not", () => {
  assert.deepEqual(Object.keys(SOURCE_LABELS).sort(), [...SOURCE_KINDS].sort());
});

test("vocabulary contract: the system instruction names every source kind", () => {
  // If the prompt and the UI disagree about this vocabulary, the model emits
  // values the renderer silently drops — the exact failure the token bug had.
  for (const kind of SOURCE_KINDS) {
    assert.match(
      BEATDOWN_SYSTEM_INSTRUCTION,
      new RegExp(`"${kind}"`),
      `system instruction never offers "${kind}" as a source value`,
    );
  }
});

test("every source kind round-trips through normalizeSource", () => {
  for (const kind of SOURCE_KINDS) {
    assert.equal(normalizeSource(kind), kind);
  }
});

test("normalizeSource tolerates casing and surrounding space from the model", () => {
  assert.equal(normalizeSource("  AO-Signature "), "ao-signature");
});

test("an unknown source string is dropped rather than rendered raw", () => {
  assert.equal(normalizeSource("vibes"), null);
});

test("a missing source is not an error", () => {
  assert.equal(normalizeSource(undefined), null);
  assert.equal(normalizeSource(null), null);
  assert.equal(normalizeSource(""), null);
  assert.equal(normalizeSource(42), null);
});
