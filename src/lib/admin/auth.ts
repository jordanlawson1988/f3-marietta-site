import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Validates the admin session from request headers.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export async function validateAdminToken(
    request: Request
): Promise<NextResponse | null> {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        return null; // Auth passed
    } catch {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }
}
