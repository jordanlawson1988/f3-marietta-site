import { getAttendanceFact } from "./getAttendanceFact";
import { getAliasMap } from "./aliasMap";
import { getSql } from "@/lib/db";
import type { SlackUser } from "./resolvePaxIdentity";

export type WeekCell = {
  /** Monday of the ISO week, YYYY-MM-DD */
  weekStart: string;
  /** posts during this week for the target PAX */
  posts: number;
};

/**
 * Build a 12-week calendar of post counts for one PAX. Used on /stats/pax to
 * surface streak risk and rhythm at a glance.
 */
export async function getStreakCalendar(
  paxSlug: string,
  weeks: number = 12,
): Promise<WeekCell[] | null> {
  try {
    const sql = getSql();
    const slackUsers = (await sql`
      SELECT slack_user_id, display_name, real_name
      FROM slack_users
      WHERE display_name IS NOT NULL OR real_name IS NOT NULL
    `) as SlackUser[];
    const aliasMap = await getAliasMap();

    // Build identity map (same logic as elsewhere).
    const slackById = new Map<string, string>();
    for (const u of slackUsers) {
      const name = u.display_name ?? u.real_name;
      if (name) slackById.set(u.slack_user_id, name);
    }
    const canonicalize = (token: string): string => {
      if (token.startsWith("U")) {
        const name = slackById.get(token) ?? aliasMap.get(token);
        if (name) return `n:${name.toLowerCase()}`;
      }
      return token;
    };

    // Pull attendance for the trailing window.
    const now = new Date();
    const todayMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const monday = (() => {
      const d = new Date(todayMs);
      const dow = (d.getUTCDay() + 6) % 7;
      return new Date(todayMs - dow * 86_400_000);
    })();
    const from = new Date(monday.getTime() - (weeks - 1) * 7 * 86_400_000);

    const fact = await getAttendanceFact({ from, to: new Date(todayMs) });

    const mine = fact.filter((f) => {
      const canonical = canonicalize(f.paxToken);
      // Loose slug match against canonical label
      const label = canonical.startsWith("n:")
        ? canonical.slice(2)
        : canonical;
      const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return slug === paxSlug;
    });

    const counts = new Map<string, number>();
    for (const f of mine) {
      const d = new Date(f.eventDate + "T00:00:00Z");
      const dow = (d.getUTCDay() + 6) % 7;
      const mondayMs = d.getTime() - dow * 86_400_000;
      const weekStart = new Date(mondayMs).toISOString().slice(0, 10);
      counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
    }

    const out: WeekCell[] = [];
    for (let i = 0; i < weeks; i++) {
      const ms = monday.getTime() - (weeks - 1 - i) * 7 * 86_400_000;
      const weekStart = new Date(ms).toISOString().slice(0, 10);
      out.push({ weekStart, posts: counts.get(weekStart) ?? 0 });
    }
    return out;
  } catch (err) {
    console.error("[getStreakCalendar] failed:", err);
    return null;
  }
}
