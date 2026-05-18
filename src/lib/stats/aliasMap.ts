/**
 * Stub for Phase 0. Returns an empty alias map so the resolution chain
 * (display_name → real_name → aliasMap → raw U…) works without depending on
 * the `pax_alias_map` table. Task 8 replaces this with a Neon-backed loader.
 */
export async function getAliasMap(): Promise<Map<string, string>> {
  return new Map();
}
