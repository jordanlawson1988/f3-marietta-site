import { NextResponse } from "next/server";

/**
 * Validates the admin token from request headers.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateAdminToken(
  request: Request
): NextResponse | null {
  const token = request.headers.get("x-admin-token");
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "Admin password not configured" },
      { status: 500 }
    );
  }

  if (token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null; // Auth passed
}
