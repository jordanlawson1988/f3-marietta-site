import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ short_id: string }> }) {
  const { short_id } = await params;
  if (!/^[a-z0-9]{8}$/.test(short_id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const sql = getSql();
  const rows = await sql`
    SELECT short_id, title, inputs, sections, generation_model, generation_ms, created_at
    FROM beatdowns
    WHERE short_id = ${short_id}
    LIMIT 1
  ` as Array<{ short_id: string; title: string; inputs: unknown; sections: unknown; generation_model: string; generation_ms: number; created_at: string }>;
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}
