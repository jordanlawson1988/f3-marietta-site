import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { generateCaption } from '@/lib/claude';
import {
  INSTAGRAM_CAPTION_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/instagram-caption';
import type { F3Event } from '@/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;

  // Fetch draft with joined event data
  const { data: draft, error: fetchError } = await supabase
    .from('instagram_drafts')
    .select(
      '*, f3_events!inner(id, ao_display_name, event_kind, title, event_date, q_name, pax_count, content_text, created_at)'
    )
    .eq('id', id)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json(
      { error: 'Draft not found', details: fetchError?.message },
      { status: 404 }
    );
  }

  // Build regeneration prompt with previous caption context
  const event = draft.f3_events as unknown as F3Event;
  const basePrompt = buildUserPrompt(event);
  const regeneratePrompt = [
    basePrompt,
    '',
    'PREVIOUS CAPTION (do NOT repeat this):',
    draft.caption,
    '',
    'Generate a DIFFERENT caption variation. Avoid repeating the previous version.',
  ].join('\n');

  try {
    const result = await generateCaption(
      INSTAGRAM_CAPTION_SYSTEM_PROMPT,
      regeneratePrompt
    );

    const { data: updated, error: updateError } = await supabase
      .from('instagram_drafts')
      .update({
        caption: result.caption,
        story_text: result.story_text,
        hashtags: result.hashtags,
        alt_text: result.alt_text,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update draft', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to regenerate caption', details: errorMessage },
      { status: 500 }
    );
  }
}
