const PAX_LINE = /^[\s*_]*PAX[\s*_]*:\s*(.+)$/im;
const COUNT_LINE = /^[\s*_]*COUNT[\s*_]*:\s*(\d+)/im;
const FNG_LINE = /^[\s*_]*FNG[s]?[\s*_]*:\s*(.+)$/im;
const SLACK_ID = /@?(U[A-Z0-9]{7,})/;
const NUMERIC_ONLY = /^[\s*_]*\d+[\s*_]*(\(.*\))?[\s*_]*$/;

const STOPWORDS = new Set([
  "none", "n/a", "na", "-", "0", "zero", "pax", "fng", "fngs", "",
]);

export type ParsedAttendance = {
  pax: Set<string>;
  headcount: number | null;
  fngTokens: Set<string>;
};

/**
 * Parse a backblast's content_text into structured attendance data.
 *
 * - PAX line: Slack IDs (@U...) and nicknames (comma-separated). Both kept
 *   in the same Set; Slack IDs as `U...`, nicknames as `n:<lowercase>`.
 * - COUNT line: integer headcount (handles "12 (incl. 2 FNG)" form).
 * - FNG line: same token format as PAX. "none" / numeric-only returns empty.
 *
 * Empty / missing lines produce empty Sets and null headcount.
 */
export function parseAttendance(content: string): ParsedAttendance {
  return {
    pax: parseRoster(content, PAX_LINE),
    headcount: parseHeadcount(content),
    fngTokens: parseFngRoster(content),
  };
}

function parseHeadcount(content: string): number | null {
  if (!content) return null;
  const m = content.match(COUNT_LINE);
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function parseRosterFromRemainder(remainder: string): Set<string> {
  const out = new Set<string>();
  const slackRe = new RegExp(SLACK_ID.source, "g");
  let m: RegExpExecArray | null;
  while ((m = slackRe.exec(remainder)) !== null) {
    out.add(m[1]);
  }
  remainder = remainder.replace(slackRe, "");
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

function parseRoster(content: string, lineRe: RegExp): Set<string> {
  if (!content) return new Set();
  const match = content.match(lineRe);
  if (!match || !match[1]) return new Set();
  return parseRosterFromRemainder(match[1].trim());
}

function parseFngRoster(content: string): Set<string> {
  if (!content) return new Set();
  const match = content.match(FNG_LINE);
  if (!match || !match[1]) return new Set();
  const remainder = match[1].trim();
  if (NUMERIC_ONLY.test(remainder)) return new Set();
  return parseRosterFromRemainder(remainder);
}

/**
 * Extract the beatdown name from a backblast's content_text. F3 backblasts
 * follow "Backblast! <NAME> DATE: <date> AO: ..." — the name is the text
 * between the "Backblast!" prefix and the DATE marker. The dedicated `title`
 * column is almost always null, so this is the reliable source. Returns null
 * when the format doesn't match or the captured name is blank.
 */
export function parseBeatdownTitle(content: string): string | null {
  if (!content) return null;
  const m = content.match(/Backblast!\s*(.+?)\s+DATE\s*:/i);
  const title = m?.[1]?.trim();
  return title ? title : null;
}
