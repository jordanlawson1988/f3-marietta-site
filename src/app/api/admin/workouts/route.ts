import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("workout_schedule")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workouts: data });
}

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
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

  const { data, error } = await supabase
    .from("workout_schedule")
    .insert({
      ao_name,
      workout_type,
      day_of_week,
      start_time,
      end_time,
      location_name: location_name || null,
      address,
      region_id,
      map_link: map_link || null,
      is_active: is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workout: data }, { status: 201 });
}
