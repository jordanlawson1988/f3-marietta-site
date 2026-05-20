// Single source of truth for member (admin/ops) access status.
// Distinct from content-draft status in src/types/automation.ts.
// The DB CHECK on member_profiles.status mirrors MEMBER_STATUSES.

export const MEMBER_STATUSES = ["pending", "admin", "revoked"] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export function isMemberStatus(value: unknown): value is MemberStatus {
    return (
        typeof value === "string" &&
        (MEMBER_STATUSES as readonly string[]).includes(value)
    );
}

// Human-readable label for each status (admin UI + status screens).
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
    pending: "Pending approval",
    admin: "Admin",
    revoked: "Access revoked",
};
