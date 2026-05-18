import { getSql } from "@/lib/db";
import { resolvePaxIdentity, type SlackUser } from "./resolvePaxIdentity";
import { getAliasMap } from "./aliasMap";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type QRanking = { label: string; key: string; count: number };

export async function getQStats(
  range: TimeRange,
  aoSlug: string | null,
): Promise<QRanking[]> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);

    const [qRows, userRows, aliasMap] = await Promise.all([
      sql`
        SELECT q.q_slack_user_id AS pax_token, e.ao_display_name AS ao_name
        FROM f3_event_qs q
        JOIN f3_events e ON e.id = q.event_id
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= ${from} AND e.event_date <= ${to}
          AND e.ao_display_name IS NOT NULL
          AND q.q_slack_user_id IS NOT NULL
      `,
      sql`
        SELECT slack_user_id, display_name, real_name
        FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL
      `,
      getAliasMap(),
    ]);

    const counts = new Map<string, number>();
    for (const row of qRows as Array<{ pax_token: string; ao_name: string }>) {
      if (aoSlug && nameToSlug(row.ao_name) !== aoSlug) continue;
      counts.set(row.pax_token, (counts.get(row.pax_token) ?? 0) + 1);
    }
    const ranked = resolvePaxIdentity(counts, userRows as SlackUser[], aliasMap);
    return ranked.map((r) => ({ label: r.label, key: r.key, count: r.count }));
  } catch (err) {
    console.error("[getQStats] failed:", err);
    return [];
  }
}
