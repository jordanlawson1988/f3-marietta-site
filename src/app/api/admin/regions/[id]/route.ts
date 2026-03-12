import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Slug is immutable after creation — remove it if present
  const { slug: _slug, id: _id, created_at: _ca, ...updates } = body;

  const { data, error } = await supabase
    .from("regions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ region: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;

  // Check if any workouts reference this region
  const { count } = await supabase
    .from("workout_schedule")
    .select("id", { count: "exact", head: true })
    .eq("region_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Region has ${count} workout(s). Remove or reassign them first.` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("regions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
