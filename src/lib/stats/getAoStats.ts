import { getSql } from "@/lib/db";
import { getOverviewStats } from "./getOverviewStats";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type AoStats = Awaited<ReturnType<typeof getOverviewStats>> & {
  aoName: string;
  aoSlug: string;
};

export async function getAoStats(
  range: TimeRange,
  aoSlug: string,
  topN: number,
): Promise<AoStats | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT ao_display_name
    FROM f3_events
    WHERE ao_display_name IS NOT NULL
  `) as Array<{ ao_display_name: string }>;
  const match = rows.find((r) => nameToSlug(r.ao_display_name) === aoSlug);
  if (!match) return null;

  const overview = await getOverviewStats(range, [aoSlug], topN);
  return {
    ...overview,
    aoName: match.ao_display_name,
    aoSlug,
  };
}
