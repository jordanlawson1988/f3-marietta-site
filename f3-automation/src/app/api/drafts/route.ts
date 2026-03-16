import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { DraftWithEvent } from '@/types';

export async function GET(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  const status = request.nextUrl.searchParams.get('status');

  let query = supabase
    .from('instagram_drafts')
    .select(
      '*, f3_events!inner(ao_display_name, event_date, q_name, pax_count, content_text)'
    )
    .order('created_at', { ascending: false });

  if (status) {
    const statuses = status.split(',');
    query = query.in('status', statuses);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch drafts', details: error.message },
      { status: 500 }
    );
  }

  // Rename f3_events -> f3_event in the response
  const drafts: DraftWithEvent[] = (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ f3_events, ...rest }: any) => ({
      ...rest,
      f3_event: f3_events,
    })
  );

  return NextResponse.json(drafts);
}
