import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveAdminState, type AdminUser } from "../src/lib/admin/auth";
import type { MemberProfile } from "../src/lib/admin/memberProfiles";
import type { MemberStatus } from "../src/lib/constants/memberStatus";

const user: AdminUser = { id: "u1", email: "a@b.com", name: "A" };

function profile(status: MemberStatus): MemberProfile {
    return {
        user_id: "u1",
        status,
        f3_name: null,
        real_name: null,
        f3nation_url: null,
        approved_by: null,
        approved_at: null,
        created_at: "2026-05-20T00:00:00Z",
        updated_at: "2026-05-20T00:00:00Z",
    };
}

test("no session -> unauthenticated", () => {
    assert.deepEqual(resolveAdminState(null, null), {
        state: "unauthenticated",
    });
});

test("session + admin profile -> admin", () => {
    const r = resolveAdminState(user, profile("admin"));
    assert.equal(r.state, "admin");
    assert.equal(r.user?.id, "u1");
});

test("session + pending profile -> pending", () => {
    assert.equal(resolveAdminState(user, profile("pending")).state, "pending");
});

test("session + revoked profile -> revoked", () => {
    assert.equal(resolveAdminState(user, profile("revoked")).state, "revoked");
});

test("session but no profile row -> pending (fail closed, not admin)", () => {
    const r = resolveAdminState(user, null);
    assert.equal(r.state, "pending");
    assert.notEqual(r.state, "admin");
});
