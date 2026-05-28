import type { TimeRange } from "./timeRange";

/**
 * Serialize a TimeRange (plus optional compare mode) into a URL query string
 * suffix. Empty defaults are dropped so links stay tidy.
 *
 *   rangeParam(r)             → "?range=last-30"  or  ""  if current-month
 *   rangeParam(r, "prior")    → "?range=last-30&compare=prior"
 *
 * Always returns a leading "?" when non-empty. Returns "" for the defaults.
 */
export function rangeParam(
  range: TimeRange,
  compare: "off" | "prior" | "yoy" = "off",
  extras: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (range.slug === "custom") {
    params.set("range", "custom");
    params.set("from", range.from.toISOString().slice(0, 10));
    params.set("to", range.to.toISOString().slice(0, 10));
  } else if (range.slug !== "current-month") {
    params.set("range", range.slug);
  }
  if (compare !== "off") params.set("compare", compare);
  for (const [k, v] of Object.entries(extras)) {
    if (v) params.set(k, v);
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
