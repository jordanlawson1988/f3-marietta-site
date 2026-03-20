import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  try {
    const sql = getSql();
    const data = await sql`SELECT * FROM regions ORDER BY sort_order ASC`;
    return NextResponse.json({ regions: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const { name, slug, sort_order, is_primary } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const regionSlug =
    slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  try {
    const sql = getSql();
    const data = await sql`
      INSERT INTO regions (name, slug, sort_order, is_primary)
      VALUES (${name}, ${regionSlug}, ${sort_order ?? 0}, ${is_primary ?? false})
      RETURNING *
    `;
    return NextResponse.json({ region: data[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
