/**
 * Resolve the hero image to show for a given backblast.
 *
 * Today: there's no per-backblast photo pipeline. We deterministically
 * rotate through a curated pool of real F3 Marietta region photos so
 * every backblast has a consistent image, and repeat views of the same
 * backblast land on the same photo.
 *
 * Future: when the Slack ingest pipeline captures and re-hosts file
 * attachments (url_private → Vercel Blob), resolve the real image first
 * and fall back to the pool only when none exists.
 */

export const REGION_PHOTO_POOL = [
  "/images/MariettaHomePage.jpeg",
  "/images/HomePage2.jpeg",
  "/images/community-group.jpg",
  "/images/workout-placeholder.jpg",
] as const;

export type RegionPhoto = (typeof REGION_PHOTO_POOL)[number];

/**
 * Deterministically pick a photo for a backblast. Same `id` + same `salt`
 * always resolves to the same image.
 */
export function getBackblastImage(id: string | null | undefined, salt = 0): RegionPhoto {
  const key = (id ?? "") + "";
  let hash = salt | 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % REGION_PHOTO_POOL.length;
  return REGION_PHOTO_POOL[idx];
}
