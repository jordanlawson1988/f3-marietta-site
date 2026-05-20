import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProfile, type MemberProfile } from "@/lib/admin/memberProfiles";

export type AdminUser = {
    id: string;
    email: string;
    name?: string | null;
};

export type AdminSessionResult =
    | { error: NextResponse; user?: undefined }
    | { error?: undefined; user: AdminUser };

/**
 * Validates the admin session from request headers.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export async function validateAdminToken(
    request: Request
): Promise<NextResponse | null> {
    const result = await getAdminSession(request);
    return result.error ?? null;
}

/**
 * Returns the authenticated admin's session (id + email) or an error
 * NextResponse. A valid session is NOT enough — the member must be
 * status='admin' (enforced via requireAdmin). Prefer this when the route
 * needs to stamp audit columns.
 */
export async function getAdminSession(
    request: Request
): Promise<AdminSessionResult> {
    const result = await requireAdmin(request);
    if (result.error) {
        return { error: result.error };
    }
    return { user: result.user };
}

// ---------------------------------------------------------------------------
// Multi-admin access model (member_profiles).
// getActiveAdmin is the authoritative server-side gate: a valid Better Auth
// session is necessary but NOT sufficient — the member must be status='admin'.
// ---------------------------------------------------------------------------

export type ActiveAdminResult =
    | { state: "unauthenticated"; user?: undefined; profile?: undefined }
    | {
          state: "pending" | "revoked";
          user: AdminUser;
          profile: MemberProfile | null;
      }
    | { state: "admin"; user: AdminUser; profile: MemberProfile };

/**
 * Pure decision logic for the access state. A session with no admin profile
 * row (or a non-admin status) is treated as 'pending' unless explicitly
 * 'revoked'. Extracted for unit testing without a live session or DB.
 */
export function resolveAdminState(
    user: AdminUser | null,
    profile: MemberProfile | null
): ActiveAdminResult {
    if (!user) {
        return { state: "unauthenticated" };
    }
    if (profile?.status === "admin") {
        return { state: "admin", user, profile };
    }
    const state = profile?.status === "revoked" ? "revoked" : "pending";
    return { state, user, profile };
}

/** Resolve the caller's access state from session + member_profiles. */
export async function getActiveAdmin(
    request: Request
): Promise<ActiveAdminResult> {
    let user: AdminUser | null = null;
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session?.user) {
            user = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name ?? null,
            };
        }
    } catch {
        user = null;
    }

    if (!user) {
        return { state: "unauthenticated" };
    }

    const profile = await getProfile(user.id);
    return resolveAdminState(user, profile);
}

/**
 * Route guard: requires status='admin'. Returns the active admin's user +
 * profile, or a NextResponse error (401 unauthenticated, 403 non-admin) for
 * the route to return directly.
 */
export async function requireAdmin(
    request: Request
): Promise<
    | { error: NextResponse; user?: undefined; profile?: undefined }
    | { error?: undefined; user: AdminUser; profile: MemberProfile }
> {
    const result = await getActiveAdmin(request);
    if (result.state === "unauthenticated") {
        return {
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }
    if (result.state !== "admin") {
        return {
            error: NextResponse.json(
                { error: "Forbidden: admin access required" },
                { status: 403 }
            ),
        };
    }
    return { user: result.user, profile: result.profile };
}
