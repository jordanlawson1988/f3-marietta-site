import { NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/admin/auth";

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  return NextResponse.json({ ok: true });
}
