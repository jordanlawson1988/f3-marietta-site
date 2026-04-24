/**
 * Resolve the hero image for a backblast.
 *
 * Preference order:
 *   1. The real Slack photo (Slackblast bot uploads these as image blocks;
 *      we extract the URL upstream into `image_url`).
 *   2. GENERIC_BACKBLAST_FALLBACK — one AI-generated F3 stock image used
 *      as the single fallback everywhere.
 *
 * NOTE: we intentionally do NOT rotate through real PAX group photos as
 * a fallback — attaching real PAX from one event to a card about a
 * different event is misleading. One neutral generic image is honest.
 */

/** Single AI-generated F3 stock image. Safe for any backblast surface. */
export const GENERIC_BACKBLAST_FALLBACK = "/images/workout-placeholder.jpg" as const;

/**
 * @param _id backblast id (unused — retained for call-site stability)
 * @param imageUrl the real Slack-uploaded image_url if present
 */
export function getBackblastImage(
  _id: string | null | undefined,
  imageUrl?: string | null,
): string {
  if (imageUrl && imageUrl.length > 0) return imageUrl;
  return GENERIC_BACKBLAST_FALLBACK;
}
