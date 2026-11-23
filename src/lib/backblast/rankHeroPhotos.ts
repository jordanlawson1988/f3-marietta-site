import { extractFirstImageUrl } from "@/lib/backblast/getBackblastsPaginated";
import { extractPaxTokens } from "@/lib/stats/getWeeklyPaxCount";

/**
 * Pure ranking for site-wide hero photography.
 *
 * The men are the point of the site, so hero backgrounds should show the
 * biggest groups we have, not merely the newest post. Ranking signal is the
 * PAX roster parsed from the backblast text — the same parser that drives
 * the Muster Log — which a vision headcount across a full quarter of photos
 * confirmed tracks the people actually in frame within one or two.
 *
 * Kept free of I/O so it can be unit-tested with plain rows; the DB window,
 * Marietta scoping, and caching live in getHeroPhotos.
 */

export interface HeroPhotoRow {
  id: string;
  event_date: string | null;
  ao_display_name: string | null;
  content_json: unknown;
  content_text: string | null;
}

export interface HeroPhoto {
  url: string;
  aoName: string | null;
  /** Slack-derived YYYY-MM-DD, or null when the backblast has no date. */
  eventDate: string | null;
  paxCount: number;
}

/**
 * Smallest roster that still reads as "a group of men" in a full-bleed hero.
 * Below this the photo is usually a selfie or a pair, which is honest on a
 * backblast card but thin as the face of the region.
 */
export const HERO_MIN_PAX = 6;

/** Default number of ranked photos to keep; comfortably covers every hero slot. */
export const HERO_DEFAULT_LIMIT = 12;

export interface RankHeroPhotosOptions {
  minPax?: number;
  limit?: number;
}

export function rankHeroPhotos(
  rows: HeroPhotoRow[],
  { minPax = HERO_MIN_PAX, limit = HERO_DEFAULT_LIMIT }: RankHeroPhotosOptions = {},
): HeroPhoto[] {
  const candidates: HeroPhoto[] = [];
  for (const row of rows) {
    const url = extractFirstImageUrl(row.content_json);
    if (!url) continue;
    const paxCount = extractPaxTokens(row.content_text ?? "").size;
    if (paxCount < minPax) continue;
    candidates.push({
      url,
      aoName: row.ao_display_name ?? null,
      eventDate: row.event_date ?? null,
      paxCount,
    });
  }

  candidates.sort((a, b) => {
    if (b.paxCount !== a.paxCount) return b.paxCount - a.paxCount;
    return (b.eventDate ?? "").localeCompare(a.eventDate ?? "");
  });

  const seen = new Set<string>();
  const ranked: HeroPhoto[] = [];
  for (const photo of candidates) {
    if (seen.has(photo.url)) continue;
    seen.add(photo.url);
    ranked.push(photo);
    if (ranked.length >= limit) break;
  }
  return ranked;
}

/**
 * Stable slot → photo assignment. Slots are small integers owned by
 * HERO_SLOTS; wrapping means a short ranked list still fills every surface
 * instead of leaving later pages on the generic fallback.
 */
export function pickHeroPhoto(photos: HeroPhoto[], slot: number): HeroPhoto | null {
  if (photos.length === 0) return null;
  return photos[((slot % photos.length) + photos.length) % photos.length] ?? null;
}

/**
 * Documentary stamp for a hero photo: "The Battlefield · 08.11.26 · 14 PAX".
 * Grounds the photo in a real workout so a context-free hero never reads as
 * stock, and tolerates missing AO or date on older rows.
 */
export function formatHeroStamp(photo: HeroPhoto): string {
  const parts: string[] = [];
  if (photo.aoName) parts.push(photo.aoName);
  const m = photo.eventDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(photo.eventDate) : null;
  if (m) parts.push(`${m[2]}.${m[3]}.${m[1].slice(2)}`);
  parts.push(`${photo.paxCount} PAX`);
  return parts.join(" · ");
}
