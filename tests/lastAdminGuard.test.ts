import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isLastAdminRemoval } from "../src/lib/admin/memberProfiles";

test("blocks demoting the only admin to revoked", () => {
    assert.equal(isLastAdminRemoval("admin", "revoked", 1), true);
});

test("blocks demoting the only admin to pending", () => {
    assert.equal(isLastAdminRemoval("admin", "pending", 1), true);
});

test("allows demoting an admin when others remain", () => {
    assert.equal(isLastAdminRemoval("admin", "revoked", 2), false);
});

test("allows approving a pending user (not a demotion)", () => {
    assert.equal(isLastAdminRemoval("pending", "admin", 1), false);
});

test("allows re-instating a revoked user", () => {
    assert.equal(isLastAdminRemoval("revoked", "admin", 0), false);
});

test("admin -> admin (no-op) is never blocked", () => {
    assert.equal(isLastAdminRemoval("admin", "admin", 1), false);
});

test("self-revocation as the last admin is blocked", () => {
    // acting admin demoting themselves; they are the only admin
    assert.equal(isLastAdminRemoval("admin", "revoked", 1), true);
});
