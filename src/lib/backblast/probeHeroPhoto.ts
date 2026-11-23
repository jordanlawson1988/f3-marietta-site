import sharp from "sharp";
import type { HeroPhotoProbe, HeroPhotoProbeFn } from "@/lib/backblast/selectHeroPhotos";

type FetchLike = (url: string) => Promise<Response>;

/**
 * Download one backblast photo and measure what the hero selector needs:
 * pixel dimensions and mean brightness. Server-only (sharp is native).
 *
 * Any failure — network, non-2xx, undecodable bytes — returns null so the
 * selector simply skips that candidate.
 */
export async function probeHeroPhoto(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<HeroPhotoProbe | null> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const image = sharp(buf);
    const [meta, stats] = await Promise.all([image.metadata(), image.stats()]);
    if (!meta.width || !meta.height || stats.channels.length < 3) return null;
    const [r, g, b] = stats.channels;
    return {
      width: meta.width,
      height: meta.height,
      luma: 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean,
    };
  } catch {
    return null;
  }
}

export const probeHeroPhotoFn: HeroPhotoProbeFn = (url) => probeHeroPhoto(url);
