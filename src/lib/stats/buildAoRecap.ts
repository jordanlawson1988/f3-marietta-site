import type { FactRow } from "./getAttendanceFact";
import { nameToSlug } from "./slugify";
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

export type AoChannel = { slackChannelId: string; aoDisplayName: string };
export type ShoutOut = { names: string[]; count: number };

type BlockStats = {
  posts: number; beatdowns: number; paxCount: number;
  topPosters: ShoutOut; topQs: ShoutOut | null; top10: RankedPax[];
};
export type AoRecapBlock = BlockStats & {
  scope: "ao"; aoDisplayName: string; slug: string; channelId: string; url: string;
};
export type RegionRecapBlock = BlockStats & { scope: "region"; aoCount: number; url: string };

/** Top names tied at the max value of `metric`; null when the max is 0. */
function shoutFrom(ranked: RankedPax[], metric: "posts" | "qd"): ShoutOut | null {
  if (ranked.length === 0) return null;
  const max = Math.max(...ranked.map((r) => r[metric]));
  if (max === 0) return null;
  return { names: ranked.filter((r) => r[metric] === max).map((r) => r.label), count: max };
}

function statsFor(fact: FactRow[], maps: RecapMaps): BlockStats {
  const ranked = rankPaxForRecap(fact, maps);
  return {
    posts: ranked.reduce((n, r) => n + r.posts, 0),
    beatdowns: new Set(fact.map((f) => f.eventId)).size,
    paxCount: ranked.length,
    topPosters: shoutFrom(ranked, "posts") ?? { names: [], count: 0 },
    topQs: shoutFrom(ranked, "qd"),
    top10: ranked.slice(0, 10),
  };
}

export function buildRecapBlocks(
  fact: FactRow[],
  aoChannels: AoChannel[],
  maps: RecapMaps,
  baseUrl: string,
): { aoBlocks: AoRecapBlock[]; regionBlock: RegionRecapBlock | null } {
  const base = baseUrl.replace(/\/+$/, "");
  const aoBlocks: AoRecapBlock[] = [];
  for (const ch of aoChannels) {
    const slug = nameToSlug(ch.aoDisplayName);
    const subset = fact.filter((f) => nameToSlug(f.aoName) === slug);
    if (subset.length === 0) continue; // skip AOs with no posts
    aoBlocks.push({
      scope: "ao", aoDisplayName: ch.aoDisplayName, slug, channelId: ch.slackChannelId,
      url: `${base}/stats?range=last-month&ao=${slug}`,
      ...statsFor(subset, maps),
    });
  }
  const regionBlock: RegionRecapBlock | null = fact.length === 0 ? null : {
    scope: "region",
    aoCount: new Set(fact.map((f) => nameToSlug(f.aoName))).size,
    url: `${base}/stats?range=last-month`,
    ...statsFor(fact, maps),
  };
  return { aoBlocks, regionBlock };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
function shoutLine(emoji: string, label: string, s: ShoutOut): string {
  return `${emoji} ${label}: ${s.names.join(", ")} (${s.count})`;
}
function topTen(headerLine: string, top10: RankedPax[]): string {
  return [headerLine, ...top10.map((p, i) => `${i + 1}. ${p.label} — ${p.posts}`)].join("\n");
}

export function buildAoRecapMessage(b: AoRecapBlock, monthLabel: string): string {
  const lines = [
    `*${b.aoDisplayName} — ${monthLabel} Recap* 🏋️`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX`,
    "",
    shoutLine("🏆", "Most posts", b.topPosters),
  ];
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd", b.topQs));
  lines.push("", topTen("Top 10 by posts:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}

export function buildRegionRecapMessage(b: RegionRecapBlock, monthLabel: string): string {
  const lines = [
    `*F3 Marietta — ${monthLabel} Region Recap* 🌎`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX · ${plural(b.aoCount, "AO")}`,
    "",
    shoutLine("🏆", "Most posts (region)", b.topPosters),
  ];
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd (region)", b.topQs));
  lines.push("", topTen("Top 10 PAX region-wide:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}
