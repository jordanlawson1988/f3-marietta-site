import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
    MEMBER_STATUSES,
    MEMBER_STATUS_LABELS,
    isMemberStatus,
} from "../src/lib/constants/memberStatus";

// Vocabulary contract: the constant, the guard, and every consumer map
// must agree on exactly the same set of values.

test("MEMBER_STATUSES holds the locked vocabulary", () => {
    assert.deepEqual([...MEMBER_STATUSES], ["pending", "admin", "revoked"]);
});

test("every status has a label, and no extra labels exist", () => {
    const labelKeys = Object.keys(MEMBER_STATUS_LABELS).sort();
    const statusKeys = [...MEMBER_STATUSES].sort();
    assert.deepEqual(labelKeys, statusKeys);
});

test("isMemberStatus accepts every declared status", () => {
    for (const status of MEMBER_STATUSES) {
        assert.equal(isMemberStatus(status), true);
    }
});

test("isMemberStatus rejects non-members", () => {
    for (const bad of ["approved", "posted", "", "ADMIN", null, undefined, 1]) {
        assert.equal(isMemberStatus(bad), false);
    }
});
