import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  try {
    const sql = getSql();
    const data = await sql`
      UPDATE regions SET
        name = ${body.name}, sort_order = ${body.sort_order},
        is_primary = ${body.is_primary}, is_active = ${body.is_active},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (data.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ region: data[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const sql = getSql();

    // Check if any workouts reference this region
    const countResult = await sql`SELECT count(*) as count FROM workout_schedule WHERE region_id = ${id}`;
    const count = parseInt(countResult[0].count);
    if (count > 0) {
      return NextResponse.json(
        { error: `Region has ${count} workout(s). Remove or reassign them first.` },
        { status: 409 }
      );
    }

    await sql`DELETE FROM regions WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
