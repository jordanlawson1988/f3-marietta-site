import { unstable_cache } from "next/cache";
import { getSql } from "@/lib/db";
import { HERO_SLOTS, type HeroSlot } from "@/lib/constants/heroSlots";
import {
  pickHeroPhoto,
  rankHeroPhotos,
  type HeroPhoto,
  type HeroPhotoRow,
} from "@/lib/backblast/rankHeroPhotos";
import { selectHeroPhotos } from "@/lib/backblast/selectHeroPhotos";
import { probeHeroPhotoFn } from "@/lib/backblast/probeHeroPhoto";

/** Rolling window the hero set is drawn from. */
export const HERO_WINDOW_DAYS = 90;

/**
 * Data-cache TTL. Hero photos change at most daily, and a dozen pages share
 * this one result, so a day-long TTL keeps the whole site at one Neon wake
 * per day for hero imagery regardless of how many pages use it.
 */
export const HERO_CACHE_SECONDS = 86_400;
export const HERO_CACHE_TAG = "hero-photos";

async function queryHeroPhotoRows(): Promise<HeroPhotoRow[]> {
  const sql = getSql();
  // Marietta scoping mirrors getWeeklyPaxCount: a backblast counts when its
  // Slack channel is an enabled ao_channels row. The NOT IN subquery is the
  // same Slackblast double-post dedupe used by getRecentBackblastPhotos.
  // event_date is cast to text in SQL so the driver's Date parsing never
  // leaks into the ranking or the stamp formatter.
  const rows = await sql`
    SELECT
      e.id,
      to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
      e.ao_display_name,
      e.content_json,
      e.content_text
    FROM f3_events e
    JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
    WHERE e.event_kind = 'backblast'
      AND e.is_deleted = false
      AND c.is_enabled = true
      AND e.event_date IS NOT NULL
      AND e.event_date >= (current_date - ${HERO_WINDOW_DAYS}::int)
      AND e.id NOT IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY slack_channel_id, ao_display_name, event_date, event_kind
            ORDER BY slack_message_ts DESC
          ) AS rn
          FROM f3_events
          WHERE event_date IS NOT NULL AND is_deleted = false
        ) ranked
        WHERE rn > 1
      )
    ORDER BY e.event_date DESC
  `;
  return rows as HeroPhotoRow[];
}

const getRankedHeroPhotosCached = unstable_cache(
  async () => {
    // Rank every qualifying backblast, then probe in rank order until the
    // slots are full. Probing downloads photos, so it runs only inside this
    // daily-cached function, never per request.
    const ranked = rankHeroPhotos(await queryHeroPhotoRows(), { limit: Number.MAX_SAFE_INTEGER });
    return selectHeroPhotos(ranked, probeHeroPhotoFn);
  },
  ["hero-photos-v2"],
  { revalidate: HERO_CACHE_SECONDS, tags: [HERO_CACHE_TAG] },
);

/**
 * Hero photos for the last HERO_WINDOW_DAYS: biggest group first, limited to
 * landscape photos bright enough to read under the hero gradient.
 * Empty on any failure (cold DB, missing DATABASE_URL in an env-less build)
 * so every surface degrades to its generic fallback instead of erroring.
 */
export async function getHeroPhotos(): Promise<HeroPhoto[]> {
  try {
    return await getRankedHeroPhotosCached();
  } catch (err) {
    console.error("[getHeroPhotos] failed:", err);
    return [];
  }
}

/** The photo a given surface should show, or null when none qualify. */
export async function getHeroPhotoForSlot(slot: HeroSlot): Promise<HeroPhoto | null> {
  return pickHeroPhoto(await getHeroPhotos(), HERO_SLOTS[slot]);
}
