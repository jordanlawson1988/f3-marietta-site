import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { buildBeatdownKnowledge } from '@/lib/beatdown/buildKnowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const result = await buildBeatdownKnowledge({ force: true });
  return NextResponse.json(result);
}
