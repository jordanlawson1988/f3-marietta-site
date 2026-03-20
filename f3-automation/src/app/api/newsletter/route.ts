import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getSql } from '@/lib/db';

export async function GET() {
  const authError = await verifySession();
  if (authError) return authError;

  try {
    const sql = getSql();

    const data = await sql`SELECT * FROM newsletters ORDER BY week_start DESC`;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
