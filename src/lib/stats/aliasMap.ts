import { cache } from "react";
import { getSql } from "@/lib/db";

/**
 * Load the pax_alias_map as a Map<slack_id, display_name>. Cached per
 * request via React `cache()` so multiple consumers in the same render
 * pay one query.
 */
export const getAliasMap = cache(async (): Promise<Map<string, string>> => {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slack_id, display_name FROM pax_alias_map
    `) as Array<{ slack_id: string; display_name: string }>;
    const out = new Map<string, string>();
    for (const r of rows) out.set(r.slack_id, r.display_name);
    return out;
  } catch (err) {
    console.error("[aliasMap] failed to load:", err);
    return new Map();
  }
});
