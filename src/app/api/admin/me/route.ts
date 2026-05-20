import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns ONLY the caller's own access state + profile. Used by the admin
// layout to decide login / status-screen / console. Not admin-gated.
export async function GET(request: Request) {
    const result = await getActiveAdmin(request);
    if (result.state === "unauthenticated") {
        return NextResponse.json({ state: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({
        state: result.state,
        email: result.user.email,
        profile: result.profile,
    });
}
