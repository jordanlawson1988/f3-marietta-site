import { getSql } from "@/lib/db";

const DAY_LABELS: Record<number, string> = {
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
  7: "SUN",
};

const FALLBACK = "MON 05:30";

function formatTime(time: string | null): string {
  if (!time) return "05:30";
  // Input may be "05:30:00" or "5:30 AM" — normalize to "HH:mm"
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "05:30";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/**
 * Look up the next Marietta Region muster (day + time).
 * Returns a label like "THU 05:30" for display in the TopBar.
 * Only considers workouts where regions.is_primary=true AND slug='marietta'.
 */
export async function getNextMarietteMuster(): Promise<string> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT ws.day_of_week, ws.start_time
      FROM workout_schedule ws
      JOIN regions r ON r.id = ws.region_id
      WHERE ws.is_active = true
        AND r.is_active = true
        AND r.slug = 'marietta'
      ORDER BY ws.day_of_week, ws.start_time
    `;

    if (!rows || rows.length === 0) return FALLBACK;

    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon..7=Sun
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    type Row = { day_of_week: number; start_time: string | null };
    const schedule = rows as Row[];

    // Prefer future musters today (same day, later time), then any upcoming day
    const withTime = schedule.map((r) => {
      const [hh, mm] = formatTime(r.start_time).split(":").map(Number);
      return { day: r.day_of_week, minutes: hh * 60 + mm, raw: r };
    });

    // 1. Today, still upcoming (workout hasn't started yet, buffer: treat as current until 30 min after start)
    const todayUpcoming = withTime.find(
      (w) => w.day === currentDay && w.minutes > currentMinutes,
    );
    if (todayUpcoming) {
      const label = DAY_LABELS[todayUpcoming.day] ?? "MON";
      return `${label} ${formatTime(todayUpcoming.raw.start_time)}`;
    }

    // 2. Next upcoming day in the week (roll through to next week)
    for (let offset = 1; offset <= 7; offset++) {
      const targetDay = ((currentDay - 1 + offset) % 7) + 1;
      const next = withTime.find((w) => w.day === targetDay);
      if (next) {
        const label = DAY_LABELS[next.day] ?? "MON";
        return `${label} ${formatTime(next.raw.start_time)}`;
      }
    }

    return FALLBACK;
  } catch (err) {
    console.error("[getNextMarietteMuster] failed:", err);
    return FALLBACK;
  }
}
