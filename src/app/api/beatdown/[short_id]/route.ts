import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ short_id: string }> }) {
  const requestId = randomUUID().slice(0, 8);
  const t0 = Date.now();
  const { short_id } = await params;
  if (!/^[a-z0-9]{8}$/.test(short_id)) {
    console.warn(`[beatdown:read:${requestId}] not_found format=invalid id=${short_id}`);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const sql = getSql();
  let rows: Array<{ short_id: string; title: string; inputs: unknown; sections: unknown; generation_model: string; generation_ms: number; created_at: string }>;
  try {
    rows = await sql`
      SELECT short_id, title, inputs, sections, generation_model, generation_ms, created_at
      FROM beatdowns
      WHERE short_id = ${short_id}
      LIMIT 1
    ` as Array<{ short_id: string; title: string; inputs: unknown; sections: unknown; generation_model: string; generation_ms: number; created_at: string }>;
  } catch (err) {
    console.error(`[beatdown:read:${requestId}] db error`, err);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (rows.length === 0) {
    console.warn(`[beatdown:read:${requestId}] not_found id=${short_id}`);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const ms = Date.now() - t0;
  console.log(`[beatdown:read:${requestId}] ok id=${short_id} ${ms}ms`);
  return NextResponse.json(rows[0]);
}
