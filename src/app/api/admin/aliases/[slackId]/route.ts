import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slackId: string }> },
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;
  const { slackId } = await params;
  if (!/^U[A-Z0-9]{7,}$/.test(slackId)) {
    return NextResponse.json({ error: "Invalid slack_id" }, { status: 400 });
  }
  try {
    const sql = getSql();
    await sql`DELETE FROM pax_alias_map WHERE slack_id = ${slackId}`;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
