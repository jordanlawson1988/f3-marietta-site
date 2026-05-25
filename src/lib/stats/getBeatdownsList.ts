import { getSql } from "@/lib/db";
import { getAliasMap } from "./aliasMap";
import { parseAttendance, parseBeatdownTitle } from "./parseAttendance";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type BeatdownRow = {
  eventId: string;
  eventDate: string; // YYYY-MM-DD
  aoName: string;
  aoSlug: string;
  beatdownTitle: string | null;
  qNames: string[];
  headcount: number | null;
  fngCount: number;
  paxCount: number;
};

type EventRow = {
  event_id: string;
  event_date: string;
  ao_name: string;
  content_text: string | null;
};

type SlackUserRow = {
  slack_user_id: string;
  display_name: string | null;
  real_name: string | null;
};

function titleCase(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Backblast roster for the active time range, optionally narrowed by AO.
 * Each row is one beatdown post — useful for the "what happened" list on the
 * admin dashboard. Q names resolve via slack_users + alias map, mirroring the
 * FNG roster identity logic.
 */
export async function getBeatdownsList(
  range: TimeRange,
  aoSlugs: string[] | null = null,
): Promise<BeatdownRow[]> {
  const sql = getSql();
  const from = range.from.toISOString().slice(0, 10);
  const to = range.to.toISOString().slice(0, 10);
  const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;

  const [eventRows, slackUsers, aliasMap] = await Promise.all([
    sql`
      SELECT
        e.id::text AS event_id,
        to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
        e.ao_display_name AS ao_name,
        e.content_text
      FROM f3_events e
      JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND c.is_enabled = true
        AND e.event_date IS NOT NULL
        AND e.event_date >= ${from} AND e.event_date <= ${to}
        AND e.ao_display_name IS NOT NULL
      ORDER BY e.event_date DESC, e.id DESC
    ` as unknown as Promise<EventRow[]>,
    sql`
      SELECT slack_user_id, display_name, real_name
      FROM slack_users
      WHERE display_name IS NOT NULL OR real_name IS NOT NULL
    ` as unknown as Promise<SlackUserRow[]>,
    getAliasMap(),
  ]);

  const slackById = new Map<string, string>();
  for (const u of slackUsers) {
    const name = u.display_name ?? u.real_name;
    if (name) slackById.set(u.slack_user_id, name);
  }

  const resolveLabel = (token: string): string => {
    if (token.startsWith("U")) {
      return slackById.get(token) ?? aliasMap.get(token) ?? token;
    }
    const lower = token.startsWith("n:") ? token.slice(2) : token;
    return titleCase(lower);
  };

  // Filter by AO post-fetch so we keep the same enable-flag and date semantics
  // as the rest of the analytics surface.
  const filtered = aoFilter
    ? eventRows.filter((r) => aoFilter.includes(nameToSlug(r.ao_name)))
    : eventRows;

  const eventIds = filtered.map((r) => r.event_id);
  const qRows = eventIds.length
    ? ((await sql`
        SELECT event_id::text AS event_id, q_slack_user_id
        FROM f3_event_qs
        WHERE event_id::text = ANY(${eventIds})
          AND q_slack_user_id IS NOT NULL
      `) as Array<{ event_id: string; q_slack_user_id: string }>)
    : [];

  const qsByEvent = new Map<string, string[]>();
  for (const row of qRows) {
    if (!qsByEvent.has(row.event_id)) qsByEvent.set(row.event_id, []);
    qsByEvent.get(row.event_id)!.push(resolveLabel(row.q_slack_user_id));
  }

  return filtered.map((row) => {
    const parsed = parseAttendance(row.content_text ?? "");
    return {
      eventId: row.event_id,
      eventDate: row.event_date,
      aoName: row.ao_name,
      aoSlug: nameToSlug(row.ao_name),
      beatdownTitle: parseBeatdownTitle(row.content_text ?? ""),
      qNames: qsByEvent.get(row.event_id) ?? [],
      headcount: parsed.headcount,
      fngCount: parsed.fngTokens.size,
      paxCount: parsed.pax.size,
    };
  });
}
