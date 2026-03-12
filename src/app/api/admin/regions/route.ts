import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ regions: data });
}

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const { name, slug, sort_order, is_primary } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const regionSlug =
    slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { data, error } = await supabase
    .from("regions")
    .insert({
      name,
      slug: regionSlug,
      sort_order: sort_order ?? 0,
      is_primary: is_primary ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ region: data }, { status: 201 });
}
