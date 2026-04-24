/**
 * Resolve the hero image for a backblast.
 *
 * Preference order:
 *   1. `image_url` — the actual photo uploaded to the Slack backblast
 *      (extracted upstream from content_json.blocks → type='image'). This
 *      is a public GCS URL (storage.googleapis.com/...).
 *   2. Deterministic pool fallback — same `id` always resolves to the same
 *      region photo so a backblast without its own photo still has a
 *      stable image on every render.
 */

export const REGION_PHOTO_POOL = [
  "/images/MariettaHomePage.jpeg",
  "/images/HomePage2.jpeg",
  "/images/community-group.jpg",
  "/images/workout-placeholder.jpg",
] as const;

export type RegionPhoto = (typeof REGION_PHOTO_POOL)[number];

/**
 * @param id backblast id (used for deterministic pool rotation when no real photo)
 * @param imageUrl the real Slack-uploaded image_url if present
 * @param salt offset the rotation (useful if multiple backblast cards render on one screen)
 */
export function getBackblastImage(
  id: string | null | undefined,
  imageUrl?: string | null,
  salt = 0,
): string {
  if (imageUrl && imageUrl.length > 0) return imageUrl;
  const key = (id ?? "") + "";
  let hash = salt | 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % REGION_PHOTO_POOL.length;
  return REGION_PHOTO_POOL[idx];
}
