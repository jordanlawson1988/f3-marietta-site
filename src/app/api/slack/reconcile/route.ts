import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { reconcileEnabledChannels } from '@/lib/slack/reconcileChannels';

// This endpoint is called by Vercel Cron as a safety net
// to catch any missed Slack events

// Vercel Cron configuration - runs at 2 AM EST daily
export const dynamic = 'force-dynamic';

/**
 * GET /api/slack/reconcile
 * Called by Vercel Cron to reconcile f3_events from Slack
 */
export async function GET(request: NextRequest) {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { processed, errors, channels } = await reconcileEnabledChannels();

        // Revalidate home + backblasts — reconciliation can insert many
        // historical rows so both surfaces may have drifted.
        revalidatePath('/');
        revalidatePath('/backblasts');

        // AI Beatdown Builder: rebuild knowledge if reconcile produced new backblasts.
        if (process.env.SKIP_BD_KNOWLEDGE !== '1') {
          try {
            const { buildBeatdownKnowledge } = await import('@/lib/beatdown/buildKnowledge');
            const knowledgeResult = await buildBeatdownKnowledge();
            console.log('[reconcile] bd-knowledge', knowledgeResult);
          } catch (knowledgeErr) {
            console.error('[reconcile] bd-knowledge build failed (non-fatal)', knowledgeErr);
          }
        }

        return NextResponse.json({
            ok: true,
            processed,
            errors,
            channels,
        });
    } catch (error) {
        console.error('Reconciliation error:', error);
        return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
    }
}
