import { getSql } from "@/lib/db";
import { extractFirstImageUrl } from "@/lib/backblast/getBackblastsPaginated";

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
    const urls: string[] = [];
    for (const r of rows) {
      const url = extractFirstImageUrl((r as { content_json: unknown }).content_json);
      if (url && !urls.includes(url)) urls.push(url);
      if (urls.length >= limit) break;
    }
    return urls;
  } catch (err) {
    console.error("[getRecentBackblastPhotos] failed:", err);
    return [];
  }
}
