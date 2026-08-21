export type AoPostStatus = "posted" | "already-posted" | "error" | "dry-run";
export type AoPostResult = {
  scope: "ao" | "region";
  label: string;       // AO display name, or "#all-f3-marietta" for region
  channelId: string;
  status: AoPostStatus;
  error?: string;
};
export type AoRecapRunReportInput = {
  monthLabel: string;
  mode: "live" | "dry-run";
  results: AoPostResult[];
  skippedEmpty: string[];  // AO display names with 0 posts
  fngTotal?: number;       // region-wide new FNGs celebrated this month
};

/** Pure, total. Channel-oriented summary DMed to the admin after each run. */
export function buildAoRecapRunReport(input: AoRecapRunReportInput): string {
  const { monthLabel, mode, results, skippedEmpty } = input;
  const by = (s: AoPostStatus) => results.filter((r) => r.status === s);
  const posted = by("posted"), already = by("already-posted"), errored = by("error"), dry = by("dry-run");

  const lines = [`F3 Marietta — AO/Region Recap Run (${monthLabel})`];
  if (mode === "dry-run") {
    lines.push(`Mode: dry-run · Would post: ${dry.length} · Skipped empty: ${skippedEmpty.length}`);
  } else {
    lines.push(`Mode: live · Posted: ${posted.length} · Already: ${already.length} · Errors: ${errored.length}`);
  }
  if (input.fngTotal && input.fngTotal > 0) {
    lines.push(`New FNGs celebrated: ${input.fngTotal}`);
  }
  if (errored.length) {
    lines.push("", `Errors (${errored.length}):`);
    for (const e of errored) lines.push(`• ${e.label} — ${e.error ?? "unknown"}`);
  }
  if (already.length) {
    lines.push("", `Already posted this month: ${already.map((a) => a.label).join(", ")}`);
  }
  if (skippedEmpty.length) {
    lines.push("", `Skipped (no posts): ${skippedEmpty.join(", ")}`);
  }
  return lines.join("\n");
}
