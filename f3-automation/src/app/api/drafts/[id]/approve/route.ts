import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

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

  // Build full caption with hashtags for easy copy-paste
  const hashtags = (draft.hashtags as string[]) ?? [];
  const fullCaption = hashtags.length > 0
    ? `${draft.caption}\n\n${hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')}`
    : draft.caption;

  // Mark as approved — manual post to Instagram for now
  const { data: approved, error: approveError } = await supabase
    .from('instagram_drafts')
    .update({
      image_url: publicUrl,
      image_storage_path: storagePath,
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (approveError) {
    return NextResponse.json(
      { error: 'Failed to approve draft', details: approveError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ...approved, full_caption: fullCaption });
}
