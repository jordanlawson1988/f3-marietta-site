/**
 * F3 Marietta region social profiles.
 * Update these URLs in one place and they'll flow to the Footer (and
 * anywhere else social is rendered). Blank string hides the link.
 */
export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/f3marietta",
  instagram: "https://www.instagram.com/f3marietta",
  x: "https://x.com/f3marietta",
} as const;

export type SocialPlatform = keyof typeof SOCIAL_LINKS;
