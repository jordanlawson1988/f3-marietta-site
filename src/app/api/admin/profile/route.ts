import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin/auth";
import { updateProfile } from "@/lib/admin/memberProfiles";
import { isValidF3NationUrl } from "@/lib/admin/f3nationUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
    // Self-service: any authenticated member edits their OWN profile,
    // regardless of admin status. Not gated by requireAdmin.
    const result = await getActiveAdmin(request);
    if (result.state === "unauthenticated") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const f3nationUrl = typeof body.f3nation_url === "string" ? body.f3nation_url : "";
    if (!isValidF3NationUrl(f3nationUrl)) {
        return NextResponse.json(
            { error: "f3nation_url must be an f3nation.com link" },
            { status: 400 }
        );
    }

    const profile = await updateProfile(result.user.id, {
        f3_name: typeof body.f3_name === "string" ? body.f3_name.trim() || null : null,
        real_name:
            typeof body.real_name === "string" ? body.real_name.trim() || null : null,
        f3nation_url: f3nationUrl.trim() || null,
    });

    return NextResponse.json({ profile });
}
