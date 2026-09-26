import { getSql } from "@/lib/db";
import { getAliasMap } from "./aliasMap";
import { parseAttendance, parseBeatdownTitle } from "./parseAttendance";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type FngEntry = {
  eventDate: string; // YYYY-MM-DD
  aoName: string;
  aoSlug: string;
  fngKey: string;
  fngLabel: string;
  eventId: string;
  beatdownTitle: string | null;
  qName: string | null;
  slackUserId: string | null;
};

export type FngsList = {
  totalInRange: number;
  totalAllTime: number;
  entries: FngEntry[];
};

type Row = {
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

export async function getFngsList(range: TimeRange): Promise<FngsList> {
  const sql = getSql();
  const from = range.from.toISOString().slice(0, 10);
  const to = range.to.toISOString().slice(0, 10);

  const [rangeRows, allTimeRows, slackUsers, aliasMap] = await Promise.all([
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
    ` as unknown as Promise<Row[]>,
    sql`
      SELECT e.content_text
      FROM f3_events e
      JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND c.is_enabled = true
    ` as unknown as Promise<Array<{ content_text: string | null }>>,
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

  const resolve = (token: string): { key: string; label: string; slackUserId: string | null } => {
    if (token.startsWith("U")) {
      const name = slackById.get(token) ?? aliasMap.get(token);
      if (name) return { key: `n:${name.toLowerCase()}`, label: name, slackUserId: token };
      return { key: token, label: token, slackUserId: token };
    }
    const lower = token.startsWith("n:") ? token.slice(2) : token;
    return { key: `n:${lower}`, label: titleCase(lower), slackUserId: null };
  };

  // Resolve the Q (beatdown leader) per event from the structured f3_event_qs
  // table — the q_name column is almost always null, so we join + resolve the
  // Slack id with the same name map used for FNG identities.
  const rangeEventIds = rangeRows.map((r) => r.event_id);
  const qRows = rangeEventIds.length
    ? ((await sql`
        SELECT event_id::text AS event_id, q_slack_user_id
        FROM f3_event_qs
        WHERE event_id::text = ANY(${rangeEventIds})
          AND q_slack_user_id IS NOT NULL
      `) as Array<{ event_id: string; q_slack_user_id: string }>)
    : [];
  const qByEvent = new Map<string, string>();
  for (const qr of qRows) {
    if (!qByEvent.has(qr.event_id)) {
      qByEvent.set(qr.event_id, resolve(qr.q_slack_user_id).label);
    }
  }

  // Earliest FNG callout per canonical identity in the selected range.
  const earliestByKey = new Map<string, FngEntry>();
  for (const row of rangeRows) {
    const tokens = parseAttendance(row.content_text ?? "").fngTokens;
    const beatdownTitle = parseBeatdownTitle(row.content_text ?? "");
    const qName = qByEvent.get(row.event_id) ?? null;
    for (const token of tokens) {
      const { key, label, slackUserId } = resolve(token);
      const candidate: FngEntry = {
        eventDate: row.event_date,
        aoName: row.ao_name,
        aoSlug: nameToSlug(row.ao_name),
        fngKey: key,
        fngLabel: label,
        eventId: row.event_id,
        beatdownTitle,
        qName,
        slackUserId,
      };
      const existing = earliestByKey.get(key);
      if (!existing || candidate.eventDate < existing.eventDate) {
        earliestByKey.set(key, candidate);
      }
    }
  }

  const entries = [...earliestByKey.values()].sort((a, b) =>
    b.eventDate.localeCompare(a.eventDate),
  );

  const allTimeKeys = new Set<string>();
  for (const row of allTimeRows) {
    const tokens = parseAttendance(row.content_text ?? "").fngTokens;
    for (const token of tokens) {
      allTimeKeys.add(resolve(token).key);
    }
  }

  return {
    totalInRange: entries.length,
    totalAllTime: allTimeKeys.size,
    entries,
  };
}
