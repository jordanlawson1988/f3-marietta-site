# Beatdown Builder — design canvas sources

These are the artboard sources for the v3 redesign, implemented in
`docs/superpowers/plans/2026-08-20-beatdown-builder-v3-intel.md`.

- `Main.dc.html` — desktop workbench (brief → generating → draft)
- `Mobile.dc.html` — phone flow, 390×844
- `Ledger.dc.html` — the archive ledger screen
- `canvas.json` — artboard layout and notes

The published canvas is at
https://claude.ai/code/artifact/24d739ec-4470-4cde-b6f8-ed6047515b2e

The seeded `beatdown-builder-redesign.html` is a 2.3MB build artifact and is
gitignored — it is regenerated from these sources.

**Where the shipped UI deliberately differs from the canvas:**

1. AO signature renders as tags, not counted bars. `per_ao_summary.top_exercises`
   is a bare `string[]`; the counts only exist in the repeat ledger, which the
   canvas conflated with the signature.
2. The mobile intel rail collapses above the brief rather than nesting inside
   the form.
3. Sample counts, dates and PAX names in the canvas are illustrative. The
   shipped page renders whatever `/api/beatdown/intel` returns, including empty.
