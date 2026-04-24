import { getSql } from "@/lib/db";

/**
 * Count distinct PAX who posted to a Marietta Region backblast during the
 * current ISO week (Monday–Sunday, Eastern Time).
 *
 * Region filter: Marietta backblasts are identified by their Slack channel
 * matching an entry in `ao_channels` (which today contains only Marietta
 * AOs). Falling back to `slack_channel_id` — rather than `ao_display_name` —
 * lets us include Slack-only AOs (e.g., Black Ops) that aren't mirrored in
 * the workout_schedule table.
 *
 * PAX source: backblast content_text (the raw Slack post body). The
 * f3_event_attendees table is currently not being populated by the ingest
 * pipeline, so we parse the `PAX:` line ourselves. Tokens are a mix of
 * Slack user IDs (@U01ABC…) and F3 nicknames (Nessie, Bill Nye, Nacho) —
 * we normalize both and dedupe across all this-week events.
 */
export async function getWeeklyPaxCount(): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`
      WITH week_bounds AS (
        SELECT
          (date_trunc('week', (now() AT TIME ZONE 'America/New_York')))::date AS week_start,
          ((date_trunc('week', (now() AT TIME ZONE 'America/New_York')) + interval '7 days'))::date AS week_end
      )
      SELECT e.content_text
      FROM f3_events e
      JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
      CROSS JOIN week_bounds wb
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND c.is_enabled = true
        AND e.event_date IS NOT NULL
        AND e.event_date >= wb.week_start
        AND e.event_date < wb.week_end
    `;

    const uniquePax = new Set<string>();
    for (const row of rows) {
      const text = (row as { content_text: string | null }).content_text ?? "";
      for (const token of extractPaxTokens(text)) {
        uniquePax.add(token);
      }
    }
    return uniquePax.size;
  } catch (err) {
    console.error("[getWeeklyPaxCount] failed:", err);
    return 0;
  }
}

/**
 * Extract and normalize the PAX roster from a backblast's content_text.
 * Handles formats like:
 *   PAX: @U01ABC @U02DEF, Nessie, Bill Nye, Nacho
 *   PAX: Fred, Ethel, Lucy
 * Slack IDs (@U...) are space-separated; F3 nicknames (which may be
 * multi-word, like "Bill Nye") are comma-separated. Returns a Set of
 * normalized tokens: Slack IDs kept as uppercase `U...`; nicknames stored
 * as lowercase `n:<name>` to avoid collisions.
 */
export function extractPaxTokens(content: string): Set<string> {
  const out = new Set<string>();
  if (!content) return out;

  // Match the PAX line up to the next newline. Case-insensitive. Tolerates
  // wrapping asterisks/underscores from Slack markdown.
  const match = content.match(/^[\s*_]*PAX[\s*_]*:\s*(.+)$/im);
  if (!match || !match[1]) return out;

  let remainder = match[1];

  // 1. Pull Slack user IDs first (@U01ABCDE… or raw U01ABCDE…). They can appear
  //    anywhere in the line, separated by spaces or commas.
  const slackIdPattern = /@?(U[A-Z0-9]{7,})/g;
  let m: RegExpExecArray | null;
  while ((m = slackIdPattern.exec(remainder)) !== null) {
    out.add(m[1]);
  }
  // Strip the matched Slack IDs so the remainder is just nicknames.
  remainder = remainder.replace(slackIdPattern, "");

  // 2. Split remaining text by comma (not whitespace) so multi-word F3 names
  //    ("Bill Nye", "The Nancy") stay intact.
  for (const piece of remainder.split(",")) {
    const name = piece
      .trim()
      // Strip leading @ and wrapping punctuation
      .replace(/^@/, "")
      .replace(/^[.<>()\[\]"'`]+|[.<>()\[\]"'`]+$/g, "")
      .trim()
      .toLowerCase();
    if (!name) continue;
    if (name === "none" || name === "n/a" || name === "-" || name === "pax") continue;
    if (name.length < 2) continue;
    out.add(`n:${name}`);
  }

  return out;
}
