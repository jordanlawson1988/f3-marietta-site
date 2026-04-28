import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { newShortId, hashIp } from '@/lib/beatdown/shortId';
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SaveBody {
  inputs: BeatdownInputs;
  draft: BeatdownDraft;
  generation_ms: number;
  model: string;
  knowledge_version: number | null;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.draft?.title || !body?.draft?.sections || !body?.inputs) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const sql = getSql();
  const ip_hash = hashIp(getClientIp(request));

  for (let attempt = 0; attempt < 3; attempt++) {
    const short_id = newShortId();
    try {
      await sql`
        INSERT INTO beatdowns (short_id, inputs, sections, title, ip_hash, generation_model, generation_ms, knowledge_version)
        VALUES (${short_id}, ${JSON.stringify(body.inputs)}, ${JSON.stringify(body.draft.sections)}, ${body.draft.title}, ${ip_hash}, ${body.model}, ${body.generation_ms}, ${body.knowledge_version})
      `;
      return NextResponse.json({ short_id });
    } catch (err) {
      const message = (err as Error).message || '';
      if (message.includes('beatdowns_short_id_key') || message.includes('duplicate key')) continue;
      console.error('[beatdown:save]', err);
      return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'short_id_collision' }, { status: 500 });
}
