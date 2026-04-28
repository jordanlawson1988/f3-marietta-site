import { NextRequest, NextResponse } from 'next/server';
import { exiconEntries } from '@/../data/f3Glossary';
import { filterExiconForFocus } from '@/lib/beatdown/exicon';
import type { BeatdownFocus } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_FOCUS: BeatdownFocus[] = ['full', 'legs', 'core', 'upper', 'cardio'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const focus = searchParams.get('focus') as BeatdownFocus | null;
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  let pool = focus && VALID_FOCUS.includes(focus) ? filterExiconForFocus(focus) : exiconEntries;

  if (q) {
    pool = pool.filter(e =>
      e.term.toLowerCase().includes(q)
      || (e.shortDescription || '').toLowerCase().includes(q)
    );
  }

  const results = pool.slice(0, 30).map(e => ({
    slug: e.id,
    term: e.term,
    shortDescription: e.shortDescription,
  }));

  return NextResponse.json({ results });
}
