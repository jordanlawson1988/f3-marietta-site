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
      UPDATE workout_schedule SET
        ao_name = ${body.ao_name}, workout_type = ${body.workout_type},
        day_of_week = ${body.day_of_week}, start_time = ${body.start_time},
        end_time = ${body.end_time}, location_name = ${body.location_name ?? null},
        address = ${body.address}, region_id = ${body.region_id},
        map_link = ${body.map_link ?? null}, is_active = ${body.is_active},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (data.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ workout: data[0] });
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
    await sql`DELETE FROM workout_schedule WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
