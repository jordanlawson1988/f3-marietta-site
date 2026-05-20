import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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
 * Returns the authenticated admin's session (id + email) or a 401 NextResponse.
 * Prefer this when the route needs to stamp audit columns.
 */
export async function getAdminSession(
    request: Request
): Promise<AdminSessionResult> {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session || !session.user) {
            return {
                error: NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                ),
            };
        }

        return {
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name ?? null,
            },
        };
    } catch {
        return {
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }
}
