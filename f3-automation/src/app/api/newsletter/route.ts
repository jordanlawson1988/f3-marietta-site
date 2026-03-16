import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const authError = await verifySession();
  if (authError) return authError;

  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .order('week_start', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
