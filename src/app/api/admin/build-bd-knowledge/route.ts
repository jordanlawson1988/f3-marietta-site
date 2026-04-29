import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildBeatdownKnowledge } from '@/lib/beatdown/buildKnowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await buildBeatdownKnowledge({ force: true });
  return NextResponse.json(result);
}
