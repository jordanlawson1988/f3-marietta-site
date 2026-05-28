import { parseTimeRange } from "./timeRange";
import { getMonthlyPaxRecap } from "./getMonthlyPaxRecap";
import type { PaxRecapRow } from "./getMonthlyPaxRecap";

const DEFAULT_SITE_URL = "https://www.f3marietta.com";

/**
 * Resolve the public base URL for recap links. Reads NEXT_PUBLIC_SITE_URL
 * when set; falls back to the production domain. Trailing slashes stripped.
 */
export function getSiteBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const url = raw && raw.length > 0 ? raw : DEFAULT_SITE_URL;
  return url.replace(/\/+$/, "");
}

/** Build the deep link to a PAX's last-month recap page. */
export function buildPaxRecapUrl(paxSlug: string, baseUrl?: string): string {
  const base = (baseUrl ?? getSiteBaseUrl()).replace(/\/+$/, "");
  return `${base}/stats/pax/${paxSlug}?range=last-month`;
}

/**
 * Format a calendar-month label for the recap message, derived from a
 * recap window. e.g. "April 2026".
 */
export function formatRecapMonth(monthStart: Date): string {
  return monthStart.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Build the body of the recap Slack message. Pure function so we can
 * unit-test the copy without firing the Slack client.
 */
export type RecapWindow = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  monthLabel: string;
};

export type RecapSample = {
  paxLabel: string;
  slackUserId: string;
  url: string;
  messagePreview: string;
};

export type RecapPlan = {
  window: RecapWindow;
  recipients: PaxRecapRow[];
  sample: RecapSample | null;
};

/**
 * Resolve the active recap window (last full calendar month) and the
 * recipient list. Shared by the cron handler (which then sends DMs) and
 * the admin preview endpoint (which renders the plan in the UI). No side
 * effects.
 */
export async function planMonthlyRecap(now: Date = new Date()): Promise<RecapPlan> {
  const range = parseTimeRange({ range: "last-month" }, now);
  if (!range) {
    throw new Error("Failed to compute last-month range");
  }
  const monthLabel = formatRecapMonth(range.from);
  const recipients = await getMonthlyPaxRecap(range);
  const window = {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    monthLabel,
  };
  return {
    window,
    recipients,
    sample: buildRecapSample(recipients, monthLabel),
  };
}

/**
 * Build the "what would the first DM look like" sample from a recipient
 * list. Pure — no I/O. Returns null for an empty list so callers can
 * cleanly render an empty-state.
 */
export function buildRecapSample(
  recipients: PaxRecapRow[],
  monthLabel: string,
  baseUrl?: string,
): RecapSample | null {
  if (recipients.length === 0) return null;
  const top = recipients[0];
  return {
    paxLabel: top.paxLabel,
    slackUserId: top.slackUserId,
    url: buildPaxRecapUrl(top.paxSlug, baseUrl),
    messagePreview: buildRecapMessage(top, monthLabel, baseUrl),
  };
}

export function buildRecapMessage(
  row: PaxRecapRow,
  monthLabel: string,
  baseUrl?: string,
): string {
  const lines: string[] = [];
  lines.push(`Hey ${row.paxLabel} — your F3 Marietta recap for ${monthLabel}:`);
  lines.push("");
  lines.push(
    `• ${row.posts} post${row.posts === 1 ? "" : "s"} across ${row.aos} AO${row.aos === 1 ? "" : "s"}`,
  );
  if (row.qd > 0) {
    lines.push(`• Q'd ${row.qd} workout${row.qd === 1 ? "" : "s"}`);
  }
  if (row.aoNames.length > 0 && row.aoNames.length <= 3) {
    lines.push(`• Where: ${row.aoNames.join(", ")}`);
  }
  lines.push("");
  lines.push("Full breakdown:");
  lines.push(buildPaxRecapUrl(row.paxSlug, baseUrl));
  lines.push("");
  lines.push("Keep showing up. — F3 Marietta");
  return lines.join("\n");
}
