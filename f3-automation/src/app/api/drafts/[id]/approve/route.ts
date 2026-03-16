import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { publishToBuffer } from '@/lib/buffer';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;

  // Read multipart form data
  const formData = await request.formData();
  const image = formData.get('image') as File | null;

  if (!image) {
    return NextResponse.json(
      { error: 'Image is required' },
      { status: 400 }
    );
  }

  // Get the draft
  const { data: draft, error: fetchError } = await supabase
    .from('instagram_drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json(
      { error: 'Draft not found', details: fetchError?.message },
      { status: 404 }
    );
  }

  // Upload image to Supabase Storage
  const extension = image.name.split('.').pop() || 'jpg';
  const storagePath = `instagram/${id}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('f3-media')
    .upload(storagePath, image, {
      contentType: image.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: 'Failed to upload image', details: uploadError.message },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('f3-media')
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // Update draft to approved with image info
  const { error: approveError } = await supabase
    .from('instagram_drafts')
    .update({
      image_url: publicUrl,
      image_storage_path: storagePath,
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (approveError) {
    return NextResponse.json(
      { error: 'Failed to approve draft', details: approveError.message },
      { status: 500 }
    );
  }

  // Build full caption with hashtags
  const hashtags = (draft.hashtags as string[]) ?? [];
  const fullCaption = hashtags.length > 0
    ? `${draft.caption}\n\n${hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')}`
    : draft.caption;

  // Attempt to publish to Buffer
  try {
    const bufferPostId = await publishToBuffer(fullCaption, publicUrl);

    const { data: posted, error: postError } = await supabase
      .from('instagram_drafts')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        buffer_post_id: bufferPostId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (postError) {
      return NextResponse.json(
        { error: 'Draft posted to Buffer but failed to update status', details: postError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(posted);
  } catch (err) {
    // Buffer publish failed — log to agent_runs, keep status as approved
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase.from('agent_runs').insert({
      run_type: 'publish_instagram',
      status: 'failure',
      error_message: errorMessage,
      details: { draft_id: id },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Return the approved draft (not posted)
    const { data: approved } = await supabase
      .from('instagram_drafts')
      .select()
      .eq('id', id)
      .single();

    return NextResponse.json(approved);
  }
}
