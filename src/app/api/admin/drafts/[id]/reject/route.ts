import { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(_request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const sql = getSql();

    const data = await sql`
      UPDATE instagram_drafts SET
        status = 'rejected',
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(data[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json(
      { error: 'Failed to reject draft', details: message },
      { status: 500 }
    );
  }
}
