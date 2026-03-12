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

  // Remove non-updatable fields
  const { id: _id, created_at: _ca, ...updates } = body;

  const { data, error } = await supabase
    .from("workout_schedule")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workout: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;

  const { error } = await supabase
    .from("workout_schedule")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
