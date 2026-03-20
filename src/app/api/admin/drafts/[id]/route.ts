import { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Check that at least one allowed field is provided
  const allowedFields = ['caption', 'story_text', 'hashtags', 'alt_text'] as const;
  const hasUpdate = allowedFields.some((field) => body[field] !== undefined);

  if (!hasUpdate) {
    return NextResponse.json(
      { error: 'No valid fields provided' },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();

    // Check existing status to determine if we should mark as edited
    const existing = await sql`SELECT status FROM instagram_drafts WHERE id = ${id}`;
    const newStatus = existing[0]?.status === 'pending' ? 'edited' : existing[0]?.status;

    const data = await sql`
      UPDATE instagram_drafts SET
        caption = COALESCE(${body.caption ?? null}, caption),
        story_text = COALESCE(${body.story_text ?? null}, story_text),
        hashtags = COALESCE(${body.hashtags ?? null}, hashtags),
        alt_text = COALESCE(${body.alt_text ?? null}, alt_text),
        status = ${newStatus},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(data[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json(
      { error: 'Failed to update draft', details: message },
      { status: 500 }
    );
  }
}
