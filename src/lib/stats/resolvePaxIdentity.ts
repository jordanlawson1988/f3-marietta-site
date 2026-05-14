export type SlackUser = {
  slack_user_id: string;
  display_name: string | null;
};

export type PaxRanking = {
  key: string;
  label: string;
  count: number;
};

/**
 * Merge Slack-ID tokens (U...) and nickname tokens (n:lowercased-name) into
 * one canonical entry per person, using slack_users.display_name as the
 * bridge. Returns ranked entries sorted by count descending.
 *
 * Limitations (acceptable for v1):
 *   - Two nicknames differing only by spacing/punctuation are not merged.
 *   - Distinctive nickname casing (e.g. "MC Hammer") is title-cased to
 *     "Mc Hammer" when there is no slack_users match.
 *   - Slack IDs without a slack_users row display as their raw "U..." token.
 */
export function resolvePaxIdentity(
  counts: Map<string, number>,
  slackUsers: SlackUser[],
): PaxRanking[] {
  const slackById = new Map<string, string>();
  const slackByName = new Map<string, string>();
  for (const u of slackUsers) {
    if (!u.display_name) continue;
    slackById.set(u.slack_user_id, u.display_name);
    slackByName.set(`n:${u.display_name.toLowerCase()}`, u.display_name);
  }

  const merged = new Map<string, number>();
  for (const [token, count] of counts) {
    let canonical = token;
    if (token.startsWith("U") && slackById.has(token)) {
      canonical = `n:${slackById.get(token)!.toLowerCase()}`;
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
