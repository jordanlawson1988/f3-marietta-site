import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Tailwind v4 resolves colour utilities from the `@theme` block. A class
 * referencing a name that block never defines is dropped silently — no build
 * error, no console warning, just an element with no background or an
 * inherited text colour. The beatdown surface shipped that way for months
 * (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`).
 *
 * This is the vocabulary contract: the tokens the components spend must be
 * the tokens `globals.css` mints.
 */

const SHADCN_TOKENS = [
  "card",
  "border",
  "foreground",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "background",
  "ring",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "secondary",
  "secondary-foreground",
];

// Directional border utilities (`border-t-primary`) are a separate namespace
// from `border-primary` and were the gap that let BeatdownLoader's spinner
// tint slip through the first version of this check.
const COLOR_PREFIXES = [
  "bg",
  "text",
  "border",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-x",
  "border-y",
  "ring",
  "fill",
  "stroke",
  "divide",
  "outline",
];

const SURFACE_DIRS = [
  "src/components/beatdown",
  "src/app/beatdown-builder",
  "src/app/beatdown",
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

function themeColorNames(): Set<string> {
  const css = readFileSync("src/app/globals.css", "utf8");
  const start = css.indexOf("@theme inline");
  assert.notEqual(start, -1, "globals.css has no @theme inline block");
  const end = css.indexOf("}", start);
  const block = css.slice(start, end);
  return new Set([...block.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

test("beatdown surface spends no colour token that @theme never mints", () => {
  const files = SURFACE_DIRS.flatMap((d) => walk(d));
  assert.ok(files.length > 0, "found no beatdown source files to scan");

  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const prefix of COLOR_PREFIXES) {
      for (const token of SHADCN_TOKENS) {
        // Bare utility only: `bg-card`, not `bg-card-foreground` and not
        // the arbitrary-value escape hatch `border-[color:var(--line-soft)]`.
        const re = new RegExp(`(^|[\\s"'\`])${prefix}-${token}(?![\\w-])`, "g");
        const hits = src.match(re);
        if (hits) offenders.push(`${file} → ${prefix}-${token} (${hits.length}x)`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these Tailwind colour utilities silently no-op:\n  ${offenders.join("\n  ")}`,
  );
});

test("the soft line tokens the app already spends are minted in @theme", () => {
  const minted = themeColorNames();
  for (const name of ["line-soft", "line-softer"]) {
    assert.ok(
      minted.has(name),
      `--color-${name} is missing from @theme, so every border-${name} in the app silently no-ops`,
    );
  }
});
