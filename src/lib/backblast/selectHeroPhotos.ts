import { HERO_DEFAULT_LIMIT, type HeroPhoto } from "@/lib/backblast/rankHeroPhotos";

/** What a probe learns about one photo without any ranking opinion. */
export interface HeroPhotoProbe {
  width: number;
  height: number;
  /** Mean Rec.601 luma, 0–255. */
  luma: number;
}

export type HeroPhotoProbeFn = (url: string) => Promise<HeroPhotoProbe | null>;

/**
 * Darkest mean luma that still shows faces under the hero gradient.
 * Calibrated against a quarter of real gloom photos: 72 reads clearly,
 * 47 disappears into the ink overlay, and nothing in the set fell between
 * 50 and 55.
 */
export const HERO_MIN_LUMA = 55;

/** How many candidates to probe at once; each probe downloads one photo. */
const PROBE_BATCH = 6;

export interface SelectHeroPhotosOptions {
  limit?: number;
  minLuma?: number;
}

function passes(probe: HeroPhotoProbe, minLuma: number): boolean {
  // Landscape only: object-cover in a wide hero crops a portrait photo down
  // to its middle third, which usually cuts the men out of frame.
  return probe.width > probe.height && probe.luma >= minLuma;
}

/**
 * Walk the PAX-ranked candidates in order, keep those that will actually
 * read as a hero (landscape, bright enough), and stop as soon as the slots
 * are filled so a full quarter of photos never has to download.
 */
export async function selectHeroPhotos(
  ranked: HeroPhoto[],
  probe: HeroPhotoProbeFn,
  { limit = HERO_DEFAULT_LIMIT, minLuma = HERO_MIN_LUMA }: SelectHeroPhotosOptions = {},
): Promise<HeroPhoto[]> {
  const kept: HeroPhoto[] = [];
  for (let i = 0; i < ranked.length && kept.length < limit; i += PROBE_BATCH) {
    const batch = ranked.slice(i, i + PROBE_BATCH);
    const probes = await Promise.all(
      batch.map((photo) => probe(photo.url).catch(() => null)),
    );
    for (let j = 0; j < batch.length && kept.length < limit; j++) {
      const result = probes[j];
      if (result && passes(result, minLuma)) kept.push(batch[j]);
    }
  }
  return kept;
}
