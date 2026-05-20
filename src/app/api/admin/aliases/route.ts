import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;
  try {
    const sql = getSql();
    const aliases = await sql`
      SELECT slack_id, display_name, notes, created_at, updated_at
      FROM pax_alias_map
      ORDER BY display_name
    `;
    return NextResponse.json({ aliases });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const slackId = typeof body.slack_id === "string" ? body.slack_id.trim() : "";
  const displayName =
    typeof body.display_name === "string" ? body.display_name.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;
  if (!/^U[A-Z0-9]{7,}$/.test(slackId)) {
    return NextResponse.json(
      { error: "slack_id must look like U01ABCDEF" },
      { status: 400 },
    );
  }
  if (!displayName) {
    return NextResponse.json(
      { error: "display_name is required" },
      { status: 400 },
    );
  }
  try {
    const sql = getSql();
    await sql`
      INSERT INTO pax_alias_map (slack_id, display_name, notes)
      VALUES (${slackId}, ${displayName}, ${notes})
      ON CONFLICT (slack_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        notes = EXCLUDED.notes
    `;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
