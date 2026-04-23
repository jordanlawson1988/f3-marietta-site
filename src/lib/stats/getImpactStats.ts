import { getSql } from "@/lib/db";

export type ImpactStats = {
  uniqueHim: number;
  workoutsLed: number;
  activeAOs: number;
  fngsThisYear: number;
};

export async function getImpactStats(): Promise<ImpactStats> {
  try {
    const sql = getSql();
    const [himRows, workoutRows, aoRows, fngRows] = await Promise.all([
      sql`SELECT COUNT(DISTINCT attendee_slack_user_id)::int AS n FROM f3_event_attendees WHERE attendee_slack_user_id IS NOT NULL`,
      sql`SELECT COUNT(*)::int AS n FROM f3_events WHERE event_kind = 'backblast' AND is_deleted = false`,
      sql`SELECT COUNT(DISTINCT ao_name)::int AS n FROM workout_schedule WHERE is_active = true`,
      sql`
        SELECT COUNT(DISTINCT a.attendee_slack_user_id)::int AS n
        FROM f3_event_attendees a
        JOIN f3_events e ON e.id = a.event_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND date_trunc('year', e.event_date::timestamp) = date_trunc('year', now())
          AND a.attendee_slack_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM f3_event_attendees a2
            JOIN f3_events e2 ON e2.id = a2.event_id
            WHERE a2.attendee_slack_user_id = a.attendee_slack_user_id
              AND e2.is_deleted = false
              AND e2.event_date::timestamp < date_trunc('year', now())
          )
      `,
    ]);
    return {
      uniqueHim: Number(himRows[0]?.n ?? 0),
      workoutsLed: Number(workoutRows[0]?.n ?? 0),
      activeAOs: Number(aoRows[0]?.n ?? 0),
      fngsThisYear: Number(fngRows[0]?.n ?? 0),
    };
  } catch (err) {
    console.error("[getImpactStats] failed:", err);
    return { uniqueHim: 0, workoutsLed: 0, activeAOs: 0, fngsThisYear: 0 };
  }
}
