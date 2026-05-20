export function nameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugMatchesName(slug: string, name: string): boolean {
  return nameToSlug(slug) === nameToSlug(name);
}
