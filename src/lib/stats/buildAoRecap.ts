import type { FactRow } from "./getAttendanceFact";
import { nameToSlug } from "./slugify";
// RecapMaps is owned by getMonthlyPaxRecap (single source of truth); re-export
// it here so callers importing from either stats module get the same type.
import type { RecapMaps } from "./getMonthlyPaxRecap";
export type { RecapMaps };
import { getSql } from "@/lib/db";
import { getAttendanceFact } from "./getAttendanceFact";
import { getAliasMap } from "./aliasMap";
import { parseTimeRange } from "./timeRange";
import { formatRecapMonth, getSiteBaseUrl, type RecapWindow } from "./buildPaxRecap";
import { getFngsList, type FngEntry } from "./getFngsList";

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
  topPosters: ShoutOut | null; topQs: ShoutOut | null; top10: RankedPax[];
};
export type AoRecapBlock = BlockStats & {
  scope: "ao"; aoDisplayName: string; slug: string; channelId: string; url: string;
  fngs: FngWelcome | null;
};
export type RegionRecapBlock = BlockStats & {
  scope: "region"; aoCount: number; url: string;
  fngs: FngWelcome | null;
};

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
    topPosters: shoutFrom(ranked, "posts"),
    topQs: shoutFrom(ranked, "qd"),
    top10: ranked.slice(0, 10),
  };
}

export type FngHonoree = { label: string; slackUserId: string | null };
export type FngWelcome = { count: number; honorees: FngHonoree[] };

/** Build a welcome bucket from FNG entries (already one-per-identity). Sorts
 *  honorees by label asc for deterministic output; null when there are none. */
function welcomeFrom(entries: FngEntry[]): FngWelcome | null {
  if (entries.length === 0) return null;
  const honorees = entries
    .map((e) => ({ label: e.fngLabel, slackUserId: e.slackUserId }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { count: honorees.length, honorees };
}

/** Group deduped FNG entries into per-AO buckets (keyed by aoSlug) and a region
 *  bucket spanning all entries. Σ(per-AO counts) == region count. Pure. */
export function groupFngs(entries: FngEntry[]): {
  byAoSlug: Map<string, FngWelcome>;
  region: FngWelcome | null;
} {
  const bySlug = new Map<string, FngEntry[]>();
  for (const e of entries) {
    const arr = bySlug.get(e.aoSlug) ?? [];
    arr.push(e);
    bySlug.set(e.aoSlug, arr);
  }
  const byAoSlug = new Map<string, FngWelcome>();
  for (const [slug, arr] of bySlug) {
    const w = welcomeFrom(arr);
    if (w) byAoSlug.set(slug, w);
  }
  return { byAoSlug, region: welcomeFrom(entries) };
}

export function buildRecapBlocks(
  fact: FactRow[],
  aoChannels: AoChannel[],
  maps: RecapMaps,
  baseUrl: string,
  fngEntries: FngEntry[] = [],
): { aoBlocks: AoRecapBlock[]; regionBlock: RegionRecapBlock | null } {
  const base = baseUrl.replace(/\/+$/, "");
  const { byAoSlug, region } = groupFngs(fngEntries);
  const aoBlocks: AoRecapBlock[] = [];
  for (const ch of aoChannels) {
    const slug = nameToSlug(ch.aoDisplayName);
    const subset = fact.filter((f) => nameToSlug(f.aoName) === slug);
    if (subset.length === 0) continue; // skip AOs with no posts
    aoBlocks.push({
      scope: "ao", aoDisplayName: ch.aoDisplayName, slug, channelId: ch.slackChannelId,
      url: `${base}/stats?range=last-month&ao=${slug}`,
      fngs: byAoSlug.get(slug) ?? null,
      ...statsFor(subset, maps),
    });
  }
  const regionBlock: RegionRecapBlock | null = fact.length === 0 ? null : {
    scope: "region",
    aoCount: new Set(fact.map((f) => nameToSlug(f.aoName))).size,
    url: `${base}/stats?range=last-month`,
    fngs: region,
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
  ];
  if (b.topPosters) lines.push(shoutLine("🏆", "Most posts", b.topPosters));
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd", b.topQs));
  lines.push("", topTen("Top 10 by posts:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}

export function buildRegionRecapMessage(b: RegionRecapBlock, monthLabel: string): string {
  const lines = [
    `*F3 Marietta — ${monthLabel} Region Recap* 🌎`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX · ${plural(b.aoCount, "AO")}`,
    "",
  ];
  if (b.topPosters) lines.push(shoutLine("🏆", "Most posts (region)", b.topPosters));
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd (region)", b.topQs));
  lines.push("", topTen("Top 10 PAX region-wide:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}

export type AoRecapPlan = {
  window: RecapWindow;
  aoBlocks: AoRecapBlock[];
  regionBlock: RegionRecapBlock | null;
  /** Enabled AOs that had zero posts in the window (no per-AO message). */
  skippedEmpty: string[];
};

export async function planMonthlyAoRecap(now: Date = new Date()): Promise<AoRecapPlan> {
  const range = parseTimeRange({ range: "last-month" }, now);
  if (!range) throw new Error("Failed to compute last-month range");
  const window: RecapWindow = {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    monthLabel: formatRecapMonth(range.from),
  };

  const sql = getSql();
  const [fact, channelRows, slackUsers, aliasMap] = await Promise.all([
    getAttendanceFact({ from: range.from, to: range.to }),
    sql`SELECT slack_channel_id, ao_display_name FROM ao_channels WHERE is_enabled = true` as
      unknown as Promise<Array<{ slack_channel_id: string; ao_display_name: string }>>,
    sql`SELECT slack_user_id, display_name, real_name FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL` as
      unknown as Promise<Array<{ slack_user_id: string; display_name: string | null; real_name: string | null }>>,
    getAliasMap(),
  ]);

  const nameById = new Map<string, string>();
  const idByName = new Map<string, string>();
  for (const u of slackUsers) {
    const name = u.display_name ?? u.real_name;
    if (!name) continue;
    nameById.set(u.slack_user_id, name);
    idByName.set(name.toLowerCase(), u.slack_user_id);
  }
  for (const [id, name] of aliasMap) {
    if (!nameById.has(id)) nameById.set(id, name);
    if (!idByName.has(name.toLowerCase())) idByName.set(name.toLowerCase(), id);
  }

  const aoChannels: AoChannel[] = channelRows.map((c) => ({
    slackChannelId: c.slack_channel_id, aoDisplayName: c.ao_display_name,
  }));
  const { aoBlocks, regionBlock } = buildRecapBlocks(
    fact, aoChannels, { nameById, idByName, aliasMap }, getSiteBaseUrl(),
  );
  const postedSlugs = new Set(aoBlocks.map((b) => b.slug));
  const skippedEmpty = aoChannels
    .filter((c) => !postedSlugs.has(nameToSlug(c.aoDisplayName)))
    .map((c) => c.aoDisplayName);
  return { window, aoBlocks, regionBlock, skippedEmpty };
}
