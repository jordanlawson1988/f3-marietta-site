/**
 * Site-wide hero photo slots.
 *
 * Each hero surface owns one slot number, which indexes into the ranked
 * list from getHeroPhotos (biggest PAX group first). Keeping the map in one
 * place guarantees two pages never share a photo by accident and that the
 * assignment is stable across builds instead of shuffling per request.
 *
 * Order is the visual pecking order: the home hero shows the single biggest
 * group of the quarter, then the home impact and join bands, then the page
 * headers roughly in the order a new visitor reaches them.
 */
export const HERO_SLOTS = {
  home: 0,
  impact: 1,
  join: 2,
  about: 3,
  workouts: 4,
  newHere: 5,
  whatToExpect: 6,
  fng: 7,
  community: 8,
  faq: 9,
  contact: 10,
  glossary: 11,
} as const;

export type HeroSlot = keyof typeof HERO_SLOTS;
