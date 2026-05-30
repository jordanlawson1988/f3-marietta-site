import type { RecapWindow } from "./buildPaxRecap";
import type { UnreachableRow } from "./getMonthlyPaxRecap";

export type RecapSendError = {
  slackUserId: string;
  paxLabel: string;
  error: string;
};

export type RecapRunReportInput = {
  window: RecapWindow; // { from, to, monthLabel }
  mode: "live" | "dry-run";
  recipientsCount: number;
  sent: number;
  errors: RecapSendError[];
  unreachable: UnreachableRow[];
  /** Cap per list before truncating with "…and N more". Default 25. */
  maxListItems?: number;
};

/**
 * Format the monthly-recap run report for the admin DM. Pure and total —
 * always returns a string, never throws — so a reporting failure can never
 * crash the cron run. Two failure classes are surfaced:
 *   - send errors  (PAX had a Slack id; chat.postMessage threw)
 *   - unreachable  (PAX posted but has no Slack mapping; got no recap)
 *
 * Collapses to a one-liner when there is nothing actionable.
 */
export function buildRecapRunReport(input: RecapRunReportInput): string {
  const { window, mode, recipientsCount, sent, errors, unreachable } = input;
  const maxListItems = input.maxListItems ?? 25;
  const month = window.monthLabel;
  const failed = errors.length;
  const unreach = unreachable.length;

  // Nothing actionable and nobody posted.
  if (recipientsCount === 0 && unreach === 0) {
    return `No PAX posted in ${month} — nothing to recap.`;
  }
  // Everyone delivered, nobody unreachable.
  if (failed === 0 && unreach === 0) {
    return `✅ All ${sent} delivered · 0 unreachable`;
  }

  const lines: string[] = [];
  lines.push(`F3 Marietta — Monthly Recap Run (${month})`);
  lines.push(
    `Mode: ${mode} · Recipients: ${recipientsCount} · Sent: ${sent} · Failed: ${failed} · Unreachable: ${unreach}`,
  );

  if (failed > 0) {
    lines.push("");
    lines.push(`Send failures (${failed}):`);
    for (const e of errors.slice(0, maxListItems)) {
      lines.push(`• ${e.paxLabel} (${e.slackUserId}) — ${e.error}`);
    }
    if (failed > maxListItems) {
      lines.push(`…and ${failed - maxListItems} more`);
    }
  }

  if (unreach > 0) {
    const sorted = [...unreachable].sort((a, b) => b.posts - a.posts);
    lines.push("");
    lines.push(`Unreachable (${unreach}):`);
    for (const u of sorted.slice(0, maxListItems)) {
      lines.push(`• "${u.paxLabel}" — ${u.posts} post${u.posts === 1 ? "" : "s"}`);
    }
    if (unreach > maxListItems) {
      lines.push(`…and ${unreach - maxListItems} more`);
    }
    lines.push(
      `These posted in ${month} but have no Slack ID → got no recap. Add a mapping.`,
    );
  }

  return lines.join("\n");
}
