# Beatdown Builder v2 — Gemini 3.1 + history-driven generation

Date: 2026-07-16 · Branch: `feat/beatdown-builder-v2` (stacked on `fix/ci-green-neon-compute`)

## Goal

World-class F3 beatdown generation: upgrade off `gemini-2.5-flash`, and make AI analysis of
previous beatdowns the backbone of every generation — not a garnish.

## Design decisions

1. **Models** — `gemini-3.1-pro-preview` primary (strongest reasoning; what Jordan asked for),
   falling back `gemini-3.5-flash` (GA) → `gemini-2.5-flash` (battle-tested last resort).
   Gemini 3.x **rejects** `thinkingConfig.thinkingBudget` (400) and Google recommends leaving
   `temperature` at 1.0 — so config is synthesized **per model family** inside the fallback
   loop: 3.x gets `thinkingLevel` and no temperature/topP; 2.5 keeps the proven legacy knobs.
2. **Reasoning levels** — generation + section-regen run `LOW` (snappy UX, ~equivalent cost to
   old 256-token budget); the nightly knowledge build runs `HIGH` (latency-free batch job).
   `maxDuration = 60` on the AI routes so pro-model latency can't hit function timeouts.
3. **History is first-class**:
   - `per_ao_summary` from `marietta_bd_knowledge` (already produced nightly by the reconcile
     cron, **previously ignored by generation**) is injected as a pinned "AO Intel" block.
   - New deterministic `extractRecentExercises()` matches Exicon terms against the last 10
     backblasts at the AO and feeds an explicit **avoid-repeat list** (term + how many of the
     last N beatdowns used it + last date). Pure function, unit-tested — no LLM required.
   - Knowledge prompt upgraded: distinguishes enduring signatures vs recent trends and
     crowd-pleasers per AO; content budget 4k→6k chars (2.5-flash had degraded to ~1.1k).
4. **Exicon ranking** — replace the crude keyword filter with tag/category-aware scoring
   (Codex tags: Legs/Arms/Core/Cardio/Full Body/Routine…), always seeding ~12 Routine/format
   entries (11s, Dora, ladders) so the model has structural vocabulary for any focus.
5. **Duration bug** — system prompt hardcoded "45 minutes" while inputs allow 15–240. Now
   parametric: ~10-12% warmup / ~75% thang / ~10% COT of the requested length.
6. **No new cron** — reconcile (07:00 UTC daily) already rebuilds knowledge when new
   backblasts land; staleness window widened 7→14 days so a failed run can't blind generation.
7. **Compute hygiene** — `/beatdown-builder` page force-dynamic → ISR 1h; admin AO mutations
   revalidate it on-demand.

## Out of scope (follow-ups)

- `unstable_cache` on `/stats/*` query layer
- Weather-aware generation; per-AO terrain profiles (static `aoContext.ts` is empty today —
  superseded by AI-derived AO Intel)
- Embedding-based retrieval (124 backblasts fit in context; revisit at ~1k+)
