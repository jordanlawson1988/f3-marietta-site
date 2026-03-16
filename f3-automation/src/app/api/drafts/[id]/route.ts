import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Build update object from allowed fields
  const allowedFields = ['caption', 'story_text', 'hashtags', 'alt_text'] as const;
  const update: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      update[field] = body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields provided' },
      { status: 400 }
    );
  }

  update.updated_at = new Date().toISOString();

  // If the draft is currently pending, mark it as edited
  const { data: existing } = await supabase
    .from('instagram_drafts')
    .select('status')
    .eq('id', id)
    .single();

  if (existing?.status === 'pending') {
    update.status = 'edited';
  }

  const { data, error } = await supabase
    .from('instagram_drafts')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update draft', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
