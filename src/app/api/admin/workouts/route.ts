import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  try {
    const sql = getSql();
    const data = await sql`SELECT * FROM workout_schedule ORDER BY day_of_week ASC, start_time ASC`;
    return NextResponse.json({ workouts: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const {
    ao_name,
    workout_type,
    day_of_week,
    start_time,
    end_time,
    location_name,
    address,
    region_id,
    map_link,
    is_active,
  } = body;

  if (!ao_name || !workout_type || !day_of_week || !start_time || !end_time || !address || !region_id) {
    return NextResponse.json(
      { error: "Missing required fields: ao_name, workout_type, day_of_week, start_time, end_time, address, region_id" },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();
    const data = await sql`
      INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region_id, map_link, is_active)
      VALUES (${ao_name}, ${workout_type}, ${day_of_week}, ${start_time}, ${end_time}, ${location_name || null}, ${address}, ${region_id}, ${map_link || null}, ${is_active ?? true})
      RETURNING *
    `;
    return NextResponse.json({ workout: data[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
