import { getSql } from "@/lib/db";
import { extractFirstImageUrl } from "@/lib/backblast/getBackblastsPaginated";

export interface RecentBackblastPhoto {
  url: string;
  eventDate: string | null;
}

/**
 * Pull recent backblast photos from Slack (via content_json image blocks).
 * Used to dynamically pipe fresh PAX-in-the-gloom photography into hero
 * sections (ImpactSection background, JoinCTASection background, etc.)
 * so the site feels alive as new backblasts post.
 *
 * Ordered newest-first. Returns only records that actually have a photo —
 * backblasts without an attached image are skipped. If none are found
 * (cold database), returns an empty array and callers fall back to their
 * local region-photo pool.
 */
export async function getRecentBackblastPhotos(limit = 6): Promise<string[]> {
  const photos = await getRecentBackblastPhotosWithMeta(limit);
  return photos.map((p) => p.url);
}

/**
 * Same source query as getRecentBackblastPhotos but preserves the event_date
 * so callers can stamp documentary date overlays on photo galleries.
 * eventDate is the original Slack-derived YYYY-MM-DD string (or null if
 * the event predates the date-extraction fallback).
 */
export async function getRecentBackblastPhotosWithMeta(
  limit = 6,
): Promise<RecentBackblastPhoto[]> {
  try {
    const sql = getSql();
    // Over-fetch since not every backblast has an attached photo.
    const rows = await sql`
      SELECT content_json, event_date, created_at
      FROM f3_events
      WHERE event_kind = 'backblast' AND is_deleted = false
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT ${Math.max(limit * 4, 24)}
    `;
    const photos: RecentBackblastPhoto[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const row = r as { content_json: unknown; event_date: string | null };
      const url = extractFirstImageUrl(row.content_json);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      photos.push({ url, eventDate: row.event_date ?? null });
      if (photos.length >= limit) break;
    }
    return photos;
  } catch (err) {
    console.error("[getRecentBackblastPhotosWithMeta] failed:", err);
    return [];
  }
}
