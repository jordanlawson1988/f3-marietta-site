import { getSql } from "@/lib/db";
import { parseAttendance } from "./parseAttendance";
import { nameToSlug } from "./slugify";

export type FactRow = {
  eventId: string;
  eventDate: string; // YYYY-MM-DD
  aoSlug: string;
  aoName: string;
  paxToken: string;
  isQ: boolean;
  headcount: number | null;
  fngCount: number;
};

export type AttendanceFactQuery = {
  from: Date;
  to: Date;
  aoSlug?: string;
};

/**
 * Build a denormalized fact table — one row per (PAX × backblast). Filtered
 * by date range and optional AO slug. Joins f3_event_qs so isQ is correct.
 *
 * Data volume is tiny (<2000 rows), so we do parsing in app code rather
 * than SQL string functions for clarity.
 */
export async function getAttendanceFact(
  q: AttendanceFactQuery,
): Promise<FactRow[]> {
  const sql = getSql();
  const from = q.from.toISOString().slice(0, 10);
  const to = q.to.toISOString().slice(0, 10);

  const events = (await sql`
    SELECT
      e.id::text AS event_id,
      e.event_date::text AS event_date,
      e.ao_display_name AS ao_name,
      e.content_text AS content_text
    FROM f3_events e
    JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
    WHERE e.event_kind = 'backblast'
      AND e.is_deleted = false
      AND c.is_enabled = true
      AND e.event_date IS NOT NULL
      AND e.event_date >= ${from}
      AND e.event_date <= ${to}
      AND e.ao_display_name IS NOT NULL
  `) as Array<{
    event_id: string;
    event_date: string;
    ao_name: string;
    content_text: string | null;
  }>;

  const eventIds = events.map((e) => e.event_id);
  const qRows = eventIds.length
    ? ((await sql`
        SELECT event_id::text AS event_id, q_slack_user_id AS pax_token
        FROM f3_event_qs
        WHERE event_id::text = ANY(${eventIds})
          AND q_slack_user_id IS NOT NULL
      `) as Array<{ event_id: string; pax_token: string }>)
    : [];

  const qsByEvent = new Map<string, Set<string>>();
  for (const row of qRows) {
    if (!qsByEvent.has(row.event_id)) qsByEvent.set(row.event_id, new Set());
    qsByEvent.get(row.event_id)!.add(row.pax_token);
  }

  const rows: FactRow[] = [];
  for (const e of events) {
    const aoSlug = nameToSlug(e.ao_name);
    if (q.aoSlug && aoSlug !== q.aoSlug) continue;
    const parsed = parseAttendance(e.content_text ?? "");
    const qsHere = qsByEvent.get(e.event_id) ?? new Set();
    const fngCount = parsed.fngTokens.size;
    for (const paxToken of parsed.pax) {
      rows.push({
        eventId: e.event_id,
        eventDate: e.event_date,
        aoSlug,
        aoName: e.ao_name,
        paxToken,
        isQ: qsHere.has(paxToken),
        headcount: parsed.headcount,
        fngCount,
      });
    }
  }
  return rows;
}
