import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listMembers } from "@/lib/admin/memberProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const members = await listMembers();
    return NextResponse.json({ members });
}
