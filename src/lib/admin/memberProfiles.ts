import { getSql } from "@/lib/db";
import type { MemberStatus } from "@/lib/constants/memberStatus";

export type MemberProfile = {
    user_id: string;
    status: MemberStatus;
    f3_name: string | null;
    real_name: string | null;
    f3nation_url: string | null;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
};

export type MemberWithAccount = MemberProfile & {
    email: string;
    name: string | null;
    account_created: string;
};

/**
 * Pure last-admin guard. Returns true when applying `newStatus` to a member
 * currently at `targetCurrentStatus` would leave the system with zero admins.
 * `adminCount` is the current number of rows at status='admin'.
 */
export function isLastAdminRemoval(
    targetCurrentStatus: MemberStatus,
    newStatus: MemberStatus,
    adminCount: number
): boolean {
    const demotingAnAdmin =
        targetCurrentStatus === "admin" && newStatus !== "admin";
    return demotingAnAdmin && adminCount <= 1;
}

export class LastAdminError extends Error {
    constructor() {
        super("Cannot remove the last remaining admin.");
        this.name = "LastAdminError";
    }
}

export async function getProfile(
    userId: string
): Promise<MemberProfile | null> {
    const sql = getSql();
    const rows = await sql`
        SELECT * FROM member_profiles WHERE user_id = ${userId}
    `;
    return (rows[0] as MemberProfile) ?? null;
}

export async function countAdmins(): Promise<number> {
    const sql = getSql();
    const rows = await sql`
        SELECT count(*)::int AS n FROM member_profiles WHERE status = 'admin'
    `;
    return (rows[0] as { n: number }).n;
}

export async function listMembers(): Promise<MemberWithAccount[]> {
    const sql = getSql();
    const rows = await sql`
        SELECT mp.*,
               u.email                AS email,
               u.name                 AS name,
               u."createdAt"          AS account_created
        FROM member_profiles mp
        JOIN "user" u ON u.id = mp.user_id
        ORDER BY mp.created_at ASC
    `;
    return rows as MemberWithAccount[];
}

/**
 * Change a member's status, stamping attribution. Enforces the last-admin
 * guard server-side. Throws LastAdminError when the transition would leave
 * zero admins.
 */
export async function updateMemberStatus(
    userId: string,
    newStatus: MemberStatus,
    actingAdminId: string
): Promise<MemberProfile> {
    const sql = getSql();
    const current = await getProfile(userId);
    if (!current) {
        throw new Error("Member not found.");
    }

    const admins = await countAdmins();
    if (isLastAdminRemoval(current.status, newStatus, admins)) {
        throw new LastAdminError();
    }

    const rows = await sql`
        UPDATE member_profiles
        SET status      = ${newStatus},
            approved_by = ${actingAdminId},
            approved_at = now(),
            updated_at  = now()
        WHERE user_id = ${userId}
        RETURNING *
    `;
    return rows[0] as MemberProfile;
}

export async function updateProfile(
    userId: string,
    fields: {
        f3_name?: string | null;
        real_name?: string | null;
        f3nation_url?: string | null;
    }
): Promise<MemberProfile> {
    const sql = getSql();
    const rows = await sql`
        UPDATE member_profiles
        SET f3_name      = ${fields.f3_name ?? null},
            real_name    = ${fields.real_name ?? null},
            f3nation_url = ${fields.f3nation_url ?? null},
            updated_at   = now()
        WHERE user_id = ${userId}
        RETURNING *
    `;
    return rows[0] as MemberProfile;
}
