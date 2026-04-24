/**
 * F3 Marietta region social profiles.
 * Update these URLs in one place and they'll flow to the Footer (and
 * anywhere else social is rendered). Blank string hides the link.
 */
export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/people/F3-Marietta/61585217978212/",
  instagram: "https://www.instagram.com/f3marietta",
  x: "https://x.com/F3MariettaGA",
} as const;

export type SocialPlatform = keyof typeof SOCIAL_LINKS;
