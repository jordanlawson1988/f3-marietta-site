import { getSql } from "@/lib/db";

/** Atomically claim (period, channel). Returns true if THIS call inserted the
 *  row (caller should post), false if it already existed (skip). */
export async function claimRecapPost(
  period: string, channelId: string, scope: "ao" | "region", aoName: string | null,
): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO monthly_ao_recap_posts (period, channel_id, scope, ao_name)
    VALUES (${period}, ${channelId}, ${scope}, ${aoName})
    ON CONFLICT (period, channel_id) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

/** Undo a claim after a failed post so a later run can retry the channel. */
export async function releaseRecapPost(period: string, channelId: string): Promise<void> {
  await getSql()`DELETE FROM monthly_ao_recap_posts WHERE period = ${period} AND channel_id = ${channelId}`;
}

/** Record the delivered Slack message ts on a successful post. */
export async function setRecapPostTs(period: string, channelId: string, ts: string): Promise<void> {
  await getSql()`UPDATE monthly_ao_recap_posts SET message_ts = ${ts} WHERE period = ${period} AND channel_id = ${channelId}`;
}
