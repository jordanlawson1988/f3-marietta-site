export type SlackUser = {
  slack_user_id: string;
  display_name: string | null;
  real_name: string | null;
};

export type PaxRanking = {
  key: string;
  label: string;
  count: number;
};

/**
 * Merge Slack-ID tokens (U...) and nickname tokens (n:lowercased-name) into
 * one canonical entry per person.
 *
 * Resolution chain for a Slack ID token:
 *   1. slack_users.display_name
 *   2. slack_users.real_name (fallback when display_name is null)
 *   3. aliasMap.get(slackId)   (admin-curated for stragglers not in slack_users)
 *   4. raw "U..." token
 *
 * Tokens whose resolved label matches a nickname token are merged into one
 * canonical entry. Returns ranked entries sorted by count descending.
 */
export function resolvePaxIdentity(
  counts: Map<string, number>,
  slackUsers: SlackUser[],
  aliasMap: Map<string, string>,
): PaxRanking[] {
  const slackById = new Map<string, string>();
  const slackByName = new Map<string, string>();
  for (const u of slackUsers) {
    const name = u.display_name ?? u.real_name;
    if (!name) continue;
    slackById.set(u.slack_user_id, name);
    slackByName.set(`n:${name.toLowerCase()}`, name);
  }

  const merged = new Map<string, number>();
  for (const [token, count] of counts) {
    let canonical = token;
    if (token.startsWith("U")) {
      const name = slackById.get(token) ?? aliasMap.get(token);
      if (name) {
        canonical = `n:${name.toLowerCase()}`;
        if (!slackByName.has(canonical)) slackByName.set(canonical, name);
      }
    }
    merged.set(canonical, (merged.get(canonical) ?? 0) + count);
  }

  const result: PaxRanking[] = [];
  for (const [key, count] of merged) {
    let label: string;
    if (slackByName.has(key)) {
      label = slackByName.get(key)!;
    } else if (key.startsWith("U")) {
      label = key;
    } else {
      label = key.slice(2).replace(/\b\w/g, (c) => c.toUpperCase());
    }
    result.push({ key, label, count });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}
