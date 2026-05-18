import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slackId: string }> },
) {
  const authErr = await validateAdminToken(request);
  if (authErr) return authErr;
  const { slackId } = await params;
  if (!/^U[A-Z0-9]{7,}$/.test(slackId)) {
    return NextResponse.json({ error: "Invalid slack_id" }, { status: 400 });
  }
  const sql = getSql();
  await sql`DELETE FROM pax_alias_map WHERE slack_id = ${slackId}`;
  return NextResponse.json({ ok: true });
}
