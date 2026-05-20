import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
    updateMemberStatus,
    LastAdminError,
} from "@/lib/admin/memberProfiles";
import { isMemberStatus } from "@/lib/constants/memberStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { error, user } = await requireAdmin(request);
    if (error) return error;

    const { userId } = await params;
    const body = await request.json().catch(() => null);
    const status = body?.status;

    if (!isMemberStatus(status)) {
        return NextResponse.json(
            { error: "Invalid status" },
            { status: 400 }
        );
    }

    try {
        const profile = await updateMemberStatus(userId, status, user.id);
        return NextResponse.json({ profile });
    } catch (err) {
        if (err instanceof LastAdminError) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        if (err instanceof Error && err.message === "Member not found.") {
            return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
    }
}
