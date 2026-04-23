import { getSql } from "@/lib/db";

export async function getWeeklyPaxCount(): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT COUNT(DISTINCT a.attendee_slack_user_id)::int AS n
      FROM f3_event_attendees a
      JOIN f3_events e ON e.id = a.event_id
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND COALESCE(e.event_date::timestamp, e.created_at) >= now() - interval '7 days'
        AND a.attendee_slack_user_id IS NOT NULL
    `;
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error("[getWeeklyPaxCount] failed:", err);
    return 0;
  }
}
