import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext } from '@/lib/beatdown/buildContext';
import { shapeIntel } from '@/lib/beatdown/intel';
import type { BeatdownIntel } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-only view of what the builder knows about an AO. The rail calls this on
 * every AO change, so the limit is looser than generate's — but it is still a
 * limit: this endpoint wakes the Neon compute.
 */
export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const rawAoId = request.nextUrl.searchParams.get('ao_id')?.trim() ?? '';

  try {
    let aoDisplayName: string | null = null;

    if (rawAoId) {
      const sql = getSql();
      const rows = (await sql`
        SELECT ao_display_name
        FROM ao_channels
        WHERE id = ${rawAoId} AND is_enabled = true
        LIMIT 1
      `) as { ao_display_name: string }[];
      if (rows.length === 0) {
        return NextResponse.json({ error: 'invalid_ao' }, { status: 400 });
      }
      aoDisplayName = rows[0].ao_display_name;
    }

    const ctx = await buildBeatdownContext({ ao_display_name: aoDisplayName });

    const intel: BeatdownIntel = shapeIntel({
      aoDisplayName,
      onFile: ctx.onFile,
      knowledge: ctx.knowledge,
      knowledgeStale: ctx.knowledgeStale,
      aoIntel: ctx.aoIntel,
      recentExercises: ctx.recentExercises,
      recent: ctx.recentAtAo.map((r) => ({
        event_date: r.event_date,
        q_name: r.q_name,
        title: r.title,
      })),
    });

    return NextResponse.json(intel);
  } catch (error) {
    // Same graceful-degradation contract as the builder page: the Q can still
    // generate without the rail, so a dead database must not blank the page.
    console.error('[beatdown:intel] failed', error);
    return NextResponse.json(
      { error: 'unavailable', message: 'Archive intel is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
