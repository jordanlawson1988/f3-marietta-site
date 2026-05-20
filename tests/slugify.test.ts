import { test } from "node:test";
import { strict as assert } from "node:assert";
import { nameToSlug, slugMatchesName } from "../src/lib/stats/slugify";

test("Black Ops -> black-ops", () => {
  assert.equal(nameToSlug("Black Ops"), "black-ops");
});

test("The Battlefield -> the-battlefield", () => {
  assert.equal(nameToSlug("The Battlefield"), "the-battlefield");
});

test("collapses multiple non-alphanumerics", () => {
  assert.equal(nameToSlug("Foo  Bar!! Baz"), "foo-bar-baz");
});

test("trims leading/trailing dashes", () => {
  assert.equal(nameToSlug("  CSAUP!  "), "csaup");
});

test("handles single-word names", () => {
  assert.equal(nameToSlug("CSAUP"), "csaup");
});

test("slugMatchesName is case-insensitive equality of slugs", () => {
  assert.equal(slugMatchesName("black-ops", "Black Ops"), true);
  assert.equal(slugMatchesName("black-ops", "BLACK OPS"), true);
  assert.equal(slugMatchesName("black-ops", "Black-Ops"), true);
  assert.equal(slugMatchesName("black-ops", "Battlefield"), false);
});
