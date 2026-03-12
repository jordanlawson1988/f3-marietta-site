import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const { action, ids, region_id, confirm } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids must be a non-empty array" },
      { status: 400 }
    );
  }

  if (!["deactivate", "delete", "change_region"].includes(action)) {
    return NextResponse.json(
      { error: "action must be one of: deactivate, delete, change_region" },
      { status: 400 }
    );
  }

  if (action === "change_region") {
    if (!region_id) {
      return NextResponse.json(
        { error: "region_id is required for change_region action" },
        { status: 400 }
      );
    }
    // Verify region exists and is active
    const { data: region } = await supabase
      .from("regions")
      .select("id")
      .eq("id", region_id)
      .eq("is_active", true)
      .single();

    if (!region) {
      return NextResponse.json(
        { error: "Invalid or inactive region_id" },
        { status: 400 }
      );
    }
  }

  if (action === "delete" && !confirm) {
    return NextResponse.json(
      { error: "confirm: true is required for bulk delete" },
      { status: 400 }
    );
  }

  let result;

  switch (action) {
    case "deactivate":
      result = await supabase
        .from("workout_schedule")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", ids)
        .select("id", { count: "exact", head: true });
      break;

    case "delete":
      result = await supabase
        .from("workout_schedule")
        .delete({ count: "exact" })
        .in("id", ids);
      break;

    case "change_region":
      result = await supabase
        .from("workout_schedule")
        .update({ region_id, updated_at: new Date().toISOString() })
        .in("id", ids)
        .select("id", { count: "exact", head: true });
      break;
  }

  if (result?.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const affected = result?.count ?? ids.length;
  return NextResponse.json({ success: true, affected });
}
