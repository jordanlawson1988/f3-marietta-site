import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validateAdminToken } from "@/lib/admin/auth";
import { getSql } from "@/lib/db";
import { getSlackClient } from "@/lib/slack/slackClient";
import {
  extractSlackImageFiles,
  rehostSlackImageFiles,
  appendImageBlocks,
} from "@/lib/slack/slackImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/backblasts/attach-photos  body: { eventId }
 *
 * Admin-only, targeted backfill: pulls the backblast's Slack message, re-hosts
 * any human-uploaded photo attachments (message.files[]) to Vercel Blob, and
 * injects image blocks into THIS row's content_json so the photo shows on the
 * site. Touches one row only (safe — no broad reconcile that could resurrect
 * soft-deleted rows). Idempotent.
 *
 * Requires the Slack app to have the `files:read` scope; without it the bot
 * cannot download url_private files and this returns a 502 (no row mutated).
 */
export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  let eventId: string | undefined;
  try {
    const body = (await request.json()) as { eventId?: unknown };
    if (typeof body?.eventId === "string") eventId = body.eventId;
  } catch {
    /* fall through to 400 */
  }
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, slack_channel_id, slack_message_ts, content_json
    FROM f3_events WHERE id = ${eventId}
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Backblast not found" }, { status: 404 });
  }

  // Fetch the original Slack message to read its file attachments.
  let files: unknown[] = [];
  try {
    const client = getSlackClient();
    const res = await client.conversations.history({
      channel: row.slack_channel_id as string,
      latest: row.slack_message_ts as string,
      oldest: row.slack_message_ts as string,
      inclusive: true,
      limit: 1,
    });
    const msg = (res.messages || [])[0] as { files?: unknown[] } | undefined;
    files = msg?.files ?? [];
  } catch (err) {
    return NextResponse.json(
      { error: `Slack fetch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const imageFiles = extractSlackImageFiles({ files });
  if (imageFiles.length === 0) {
    return NextResponse.json({
      ok: true,
      attached: 0,
      message: "No image attachments on the Slack message.",
    });
  }

  const urls = await rehostSlackImageFiles(imageFiles);
  if (urls.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        attached: 0,
        error:
          "Found image attachment(s) but could not re-host them. Check the Slack app `files:read` scope and BLOB_READ_WRITE_TOKEN.",
      },
      { status: 502 },
    );
  }

  const updated = appendImageBlocks(row.content_json, urls);
  await sql`
    UPDATE f3_events SET content_json = ${JSON.stringify(updated)}, updated_at = now()
    WHERE id = ${eventId}
  `;

  revalidatePath("/");
  revalidatePath("/backblasts");
  revalidatePath(`/backblasts/${eventId}`);

  return NextResponse.json({ ok: true, attached: urls.length, urls });
}
