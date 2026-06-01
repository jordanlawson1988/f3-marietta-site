import type { FactRow } from "./getAttendanceFact";
// RecapMaps is owned by getMonthlyPaxRecap (single source of truth); re-export
// it here so callers importing from either stats module get the same type.
import type { RecapMaps } from "./getMonthlyPaxRecap";
export type { RecapMaps };

export type RankedPax = { label: string; posts: number; qd: number };

/** Canonical key + display label for a paxToken. Nickname tokens that resolve
 *  to a slack id are merged onto that id; unmapped nicknames keep their token. */
function resolve(token: string, maps: RecapMaps): { key: string; label: string } {
  if (token.startsWith("U")) {
    return { key: token, label: maps.nameById.get(token) ?? maps.aliasMap.get(token) ?? token };
  }
  if (token.startsWith("n:")) {
    const name = token.slice(2);
    const id = maps.idByName.get(name.toLowerCase());
    if (id) return { key: id, label: maps.nameById.get(id) ?? maps.aliasMap.get(id) ?? name };
    return { key: token, label: name };
  }
  return { key: token, label: token };
}

/** Aggregate fact rows into ranked PAX (distinct beatdowns attended + Q'd),
 *  sorted by posts desc then label asc. Pure. */
export function rankPaxForRecap(fact: FactRow[], maps: RecapMaps): RankedPax[] {
  type Agg = { label: string; posts: Set<string>; qd: Set<string> };
  const byKey = new Map<string, Agg>();
  for (const f of fact) {
    const { key, label } = resolve(f.paxToken, maps);
    let a = byKey.get(key);
    if (!a) { a = { label, posts: new Set(), qd: new Set() }; byKey.set(key, a); }
    a.posts.add(f.eventId);
    if (f.isQ) a.qd.add(f.eventId);
  }
  return [...byKey.values()]
    .map((a) => ({ label: a.label, posts: a.posts.size, qd: a.qd.size }))
    .sort((x, y) => y.posts - x.posts || x.label.localeCompare(y.label));
}
