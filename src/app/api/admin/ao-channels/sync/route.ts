import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { validateAdminToken } from '@/lib/admin/auth';
import { reconcileEnabledChannels } from '@/lib/slack/reconcileChannels';

export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  try {
    const result = await reconcileEnabledChannels();
    revalidatePath('/');
    revalidatePath('/backblasts');
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
