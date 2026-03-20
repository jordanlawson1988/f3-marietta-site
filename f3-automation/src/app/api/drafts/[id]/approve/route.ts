import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { put } from '@vercel/blob';

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
  const sql = getSql();
  const drafts = await sql`SELECT * FROM instagram_drafts WHERE id = ${id}`;

  if (drafts.length === 0) {
    return NextResponse.json(
      { error: 'Draft not found' },
      { status: 404 }
    );
  }

  const draft = drafts[0];

  // Upload image to Vercel Blob
  const extension = image.name.split('.').pop() || 'jpg';
  const blobPath = `instagram/${id}.${extension}`;

  const blob = await put(blobPath, image, {
    access: 'public',
    addRandomSuffix: false, // keep predictable paths
  });

  const publicUrl = blob.url;

  // Build full caption with hashtags for easy copy-paste
  const hashtags = (draft.hashtags as string[]) ?? [];
  const fullCaption = hashtags.length > 0
    ? `${draft.caption}\n\n${hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')}`
    : draft.caption;

  // Mark as approved — manual post to Instagram for now
  const now = new Date().toISOString();
  const updated = await sql`
    UPDATE instagram_drafts
    SET image_url = ${publicUrl},
        image_storage_path = ${blobPath},
        status = 'approved',
        approved_at = ${now},
        updated_at = ${now}
    WHERE id = ${id}
    RETURNING *
  `;

  if (updated.length === 0) {
    return NextResponse.json(
      { error: 'Failed to approve draft' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ...updated[0], full_caption: fullCaption });
}
