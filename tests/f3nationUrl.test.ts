import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isValidF3NationUrl } from "../src/lib/admin/f3nationUrl";

test("empty string is allowed", () => {
    assert.equal(isValidF3NationUrl(""), true);
    assert.equal(isValidF3NationUrl("   "), true);
});

test("accepts me.f3nation.com profile links", () => {
    assert.equal(isValidF3NationUrl("https://me.f3nation.com/u/abc123"), true);
    assert.equal(isValidF3NationUrl("https://f3nation.com/whatever"), true);
});

test("rejects non-f3nation hosts", () => {
    assert.equal(isValidF3NationUrl("https://example.com/u/abc"), false);
    assert.equal(isValidF3NationUrl("https://notf3nation.com.evil.com"), false);
});

test("rejects garbage", () => {
    assert.equal(isValidF3NationUrl("not a url"), false);
});
