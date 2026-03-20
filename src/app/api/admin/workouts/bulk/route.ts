import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";

export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
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
    try {
      const sql = getSql();
      const regionRows = await sql`SELECT id FROM regions WHERE id = ${region_id} AND is_active = true`;
      if (regionRows.length === 0) {
        return NextResponse.json(
          { error: "Invalid or inactive region_id" },
          { status: 400 }
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Database error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "delete" && !confirm) {
    return NextResponse.json(
      { error: "confirm: true is required for bulk delete" },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();
    let affected = 0;

    switch (action) {
      case "deactivate": {
        const result = await sql`UPDATE workout_schedule SET is_active = false, updated_at = now() WHERE id = ANY(${ids}) RETURNING id`;
        affected = result.length;
        break;
      }

      case "delete": {
        await sql`DELETE FROM workout_schedule WHERE id = ANY(${ids})`;
        affected = ids.length;
        break;
      }

      case "change_region": {
        const result = await sql`UPDATE workout_schedule SET region_id = ${region_id}, updated_at = now() WHERE id = ANY(${ids}) RETURNING id`;
        affected = result.length;
        break;
      }
    }

    return NextResponse.json({ success: true, affected });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
