const STOPWORDS = new Set([
  "none",
  "n/a",
  "na",
  "-",
  "0",
  "zero",
  "pax",
  "fng",
  "fngs",
  "",
]);

const FNG_LINE = /^[\s*_]*FNG[s]?[\s*_]*:\s*(.+)$/im;
const NUMERIC_ONLY = /^[\s*_]*\d+[\s*_]*(\(.*\))?[\s*_]*$/;
const SLACK_ID = /@?(U[A-Z0-9]{7,})/g;

/**
 * Extract FNG names from a backblast's content_text.
 *
 * Returns a Set of normalized tokens:
 *   - Slack user IDs kept as uppercase `U...`
 *   - Free-text nicknames stored as `n:<lowercased-name>`
 *
 * Returns an empty Set for missing lines, "FNG: none", and numeric-only
 * lines (e.g. "FNG: 2") — without names we can't dedupe across the year.
 */
export function parseFngLine(content: string): Set<string> {
  const out = new Set<string>();
  if (!content) return out;

  const match = content.match(FNG_LINE);
  if (!match || !match[1]) return out;

  let remainder = match[1].trim();
  if (NUMERIC_ONLY.test(remainder)) return out;

  // Pull Slack IDs first so they don't get mangled by nickname normalization.
  let m: RegExpExecArray | null;
  while ((m = SLACK_ID.exec(remainder)) !== null) {
    out.add(m[1]);
  }
  remainder = remainder.replace(SLACK_ID, "");

  for (const piece of remainder.split(",")) {
    const name = piece
      .trim()
      .replace(/^@/, "")
      .replace(/^[*_.<>()\[\]"'`]+|[*_.<>()\[\]"'`]+$/g, "")
      .trim()
      .toLowerCase();
    if (!name || STOPWORDS.has(name) || name.length < 2) continue;
    out.add(`n:${name}`);
  }

  return out;
}
