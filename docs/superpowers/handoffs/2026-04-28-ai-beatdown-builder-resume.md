# AI Beatdown Builder — Session Handoff

**Date:** 2026-04-28
**Branch:** `feature/ai-beatdown-builder` (11 commits, NOT pushed)
**Status:** 7 of 22 plan tasks complete. Foundation solid. Ready for Task 8 (generate API route).

---

## How to resume in a new session

1. **Open the resume context** — read these files in order:
   - This handoff: `docs/superpowers/handoffs/2026-04-28-ai-beatdown-builder-resume.md`
   - The plan: `docs/superpowers/plans/2026-04-27-ai-beatdown-builder.md`
   - The spec (only if needed for design intent): `docs/superpowers/specs/2026-04-27-ai-beatdown-builder-design.md`

2. **Verify branch state**:
   ```bash
   git checkout feature/ai-beatdown-builder
   git log origin/main..HEAD --oneline   # expect 11 commits
   git status --short                    # expect clean
   ```

3. **Pick up at Task 8** — `POST /api/beatdown/generate`. The plan has the full code in "Task 8" of the plan doc. Use `superpowers:subagent-driven-development` to dispatch implementers as before.

4. **Resume command suggestion**:
   ```
   Read docs/superpowers/handoffs/2026-04-28-ai-beatdown-builder-resume.md
   then continue executing the plan at Task 8 with subagent-driven development.
   ```

---

## Project context

**App:** F3 Marietta (`/Users/jordan.lawson/Projects/f3-marietta`) — Next.js 16 + Neon Postgres + Better Auth on Vercel. Single-region site for an F3 men's workout group.

**Feature being built:** AI Beatdown Builder — a public, mobile-first Q tool at `/beatdown-builder` that generates F3-format workouts (Warm-up / The Thang / COT) grounded in F3 Marietta backblasts, the Exicon, and a curated famous-BD library. Customizable, savable, printable. Uses Gemini 2.5 Flash for per-request generation and Claude Sonnet 4.6 for nightly knowledge distillation.

**Why we built it:** Qs were reaching for ChatGPT/Claude — generic LLMs that don't know our AOs, our PAX, or our voice. This grounds every generation in F3 Marietta-specific data.

**Approach 2** (the chosen architecture): Precomputed `marietta_bd_knowledge` doc rebuilt nightly inside the existing `/api/slack/reconcile` cron (avoids 3rd Vercel cron — Hobby allows 2). Per-request: knowledge + last 10 backblasts at AO + Exicon (filtered by focus) + famous BD library → Gemini Flash → JSON.

---

## Decisions locked in (don't re-litigate)

- **Access:** Public, no login, rate-limited 10/min/IP (matches AMA assistant)
- **Inputs:** AO, Focus, Theme, Equipment (multi), Famous BD (optional), Q's Notes (≤200 chars). Length defaults to 45 min, intensity to standard
- **Output:** Warm-up / The Thang / COT (Disclaimer dropped; Mary folds into Thang). Adaptive detail level (terse default; coaching cues for FNG-friendly or Q-school themes)
- **Customization:** Level B Moderate — regenerate full + per-section + swap exercise (Exicon picker) + add/remove + free-text edit
- **Share:** Mobile-first responsive view, dark mode default, print stylesheet for paper, Save → public `/beatdown/[short_id]`, Copy as Slackblast button
- **AI:** Gemini 2.5 Flash for per-request, Claude Sonnet 4.6 for nightly knowledge
- **Grounding sources:** ALL F3 Marietta backblasts (not nationwide), curated famous-BD library + IPC workouts, full local Exicon

---

## Repo state

**Branch:** `feature/ai-beatdown-builder` (off `main`)

**Commits on the branch (newest → oldest):**
```
2f481c4 fix(beatdown): dedup fallback backblasts and parallelize knowledge + AO queries
a28da16 feat(beatdown): prompt builders and context assembly
e68772e feat(beatdown): exicon focus filter helper
147a776 fix(beatdown): close fence regex, FNG-friendly label, log on bad MD frontmatter
6780a74 feat(beatdown): library loader, slackblast formatter, response parser
5d1117d feat(beatdown): famous BD library — Hammer Time, Wheel, Lap Pyramid, Cinco, Jacob's Ladder, 4 Corners + 2 IPC
24aaab5 feat(beatdown): famous BD library — README + first 4 files (Murph, 11s, Dora, Jack Webb)
516a08f feat(beatdown): TypeScript types and option enums
673a894 feat(beatdown): migration for beatdowns + marietta_bd_knowledge tables
6bad10f docs(plan): AI Beatdown Builder implementation plan
c38af6c docs(spec): AI Beatdown Builder design + roadmap update
```

**Live database state:** Migration applied to Neon. `beatdowns` and `marietta_bd_knowledge` tables exist with all indexes + the `beatdowns_updated_at` trigger. No rows yet in either table (expected — knowledge row gets populated by Task 13's reconcile-piggyback).

**Vercel impact:** None. Nothing pushed. `vercel.json` `ignoreCommand` already excludes `*.md`, `docs/`, `scripts/`, `.claude/`, `.superpowers/` — so even if pushed, the spec/plan/handoff commits wouldn't trigger a build. Code commits would, once we push to `develop`.

---

## Done — Tasks 1–7

### Task 1 (commit `673a894`) — Schema
- `supabase/migrations/20260427_beatdown_builder.sql` — creates `beatdowns` (id, short_id, inputs jsonb, sections jsonb, title, ip_hash, generation_model, generation_ms, knowledge_version, timestamps) and `marietta_bd_knowledge` (id serial, generated_at, source_event_count, content, per_ao_summary jsonb, generation_model, generation_ms, cost_usd)
- Appended to `scripts/neon-schema.sql`

### Task 2 (commit `516a08f`) — Types
- `src/types/beatdown.ts` — `BeatdownFocus`, `BeatdownTheme` (`null` allowed), `BeatdownEquipment`, `BeatdownInputs`, `BeatdownExerciseItem`, `BeatdownSections`, `BeatdownDraft`, `BeatdownRecord`, `MariettaBdKnowledge`, plus `FOCUS_OPTIONS`, `THEME_OPTIONS`, `EQUIPMENT_OPTIONS` const arrays for chip groups

### Tasks 3–4 (commits `24aaab5`, `5d1117d`) — Famous BD library
- 12 markdown files in `data/content/famous-beatdowns/` + README
  - **famous (10):** murph, 11s, dora-1-2-3, jack-webb, hammer-time, wheel-of-misery, lap-pyramid, cinco-de-burpee, jacobs-ladder, 4-corners
  - **ipc (2):** ipc-2024-round-1, ipc-2024-round-2
- Each file has frontmatter (`title`, `slug`, `category`, `length_min`, `equipment`, `focus`, `description`) + Structure / Variations / Marietta notes sections under 200 words

### Task 5 (commits `6780a74` + fix `147a776`) — Lib helpers
- `src/lib/beatdown/loadFamousBeatdowns.ts` — module-cached MD loader, `loadFamousBeatdowns()` and `findFamousBeatdown(slug)`. Now logs `console.warn` for malformed files.
- `src/lib/beatdown/formatSlackblast.ts` — pure fn turning `{draft, inputs}` into Slack mrkdwn. Uses `THEME_OPTIONS` lookup (was `Fng Friendly` → now correctly `FNG-friendly`).
- `src/lib/beatdown/parseResponse.ts` — defensive JSON parser. **`stripCodeFences` regex was buggy** for trailing-newline fenced output — fixed to `/^```(?:json)?\n?/im` + `/\n?```\s*$/m`. Handles strict JSON, fenced (with/without trailing newline), trailing commas; throws on missing required keys.

### Task 6 (commit `e68772e`) — Exicon filter
- `src/lib/beatdown/exicon.ts` — `filterExiconForFocus(focus, max=80)`. Keyword-matches Exicon entries, backfills with general entries when focus has <20 matches.
- Exicon size: ~70 entries total (smaller than I'd thought — F3 Lexicon CSV has ~2000 but only ~70 are exicon-tagged).

### Task 7 (commits `a28da16` + fix `2f481c4`) — Prompt builders + context
- `src/lib/beatdown/prompts/system.ts` — `BEATDOWN_SYSTEM_INSTRUCTION` constant: voice, format rules, JSON schema. "Output JSON only" terminator.
- `src/lib/beatdown/prompts/user.ts` — `buildUserPrompt(args)` assembles 6 ordered blocks: Knowledge (if present) → Famous Library → Exicon (filtered) → Recent at AO (dynamic) → Selected Famous BD body (if chosen) → Q Inputs.
- `src/lib/beatdown/buildContext.ts` — `buildBeatdownContext(inputs)` async. **Now parallelizes** knowledge + AO-recent queries via `Promise.all`. **Now dedups** the region-wide fallback by ID against the AO query. `loadStaticContext(inputs)` returns Exicon subset + famous lib + selected BD.
- Live DB sanity-checked: `The Battlefield` returns 10 real backblasts; knowledge is null until Task 12/13 wire up the cron.

---

## Remaining — Tasks 8–22

### Chunk 3: Core API (Tasks 8–11)
- **Task 8** — `POST /api/beatdown/generate` — input validation, calls Gemini 2.5 Flash with assembled prompt, parses response, returns `{ title, sections, generation_ms, model, knowledge_version }`. Rate-limited 10/min. **First end-to-end LLM call.**
- **Task 9** — `POST /api/beatdown/regenerate-section` — narrower prompt, regenerates one of warmup/thang/cot only. Rate-limited 20/min.
- **Task 10** — `POST /api/beatdown/save` + `GET /api/beatdown/[short_id]` + `src/lib/beatdown/shortId.ts` — short-id generator (8-char Crockford-ish base32, salted IP hash for ip_hash field).
- **Task 11** — `GET /api/beatdown/exicon-search?focus=&q=` — used by the swap modal in Chunk 5.

### Chunk 4: Knowledge builder (Tasks 12–13)
- **Task 12** — `src/lib/beatdown/buildKnowledge.ts` + `src/lib/beatdown/prompts/marietta-knowledge.ts` — Claude Sonnet 4.6 distills ALL backblasts into `{content, per_ao_summary}` JSON, persists to `marietta_bd_knowledge`, deletes >30d old rows.
- **Task 13** — `POST /api/admin/build-bd-knowledge` (admin-only manual trigger) + integrate `buildBeatdownKnowledge()` into `/api/slack/reconcile` route's success path inside try/catch (non-fatal).

### Chunk 5: UI (Tasks 14–18) — has internal forward refs, build-verify only at end
- **Task 14** — `/beatdown-builder` page + `BeatdownBuilderClient.tsx` (state owner) + `BeatdownForm.tsx` + `BeatdownLoader.tsx`. (Task 15's `BeatdownDisplay` import will be a forward-ref until Task 15 finishes — note in plan.)
- **Task 15** — `BeatdownDisplay.tsx` + `BeatdownSection.tsx` + `ExerciseRow.tsx`.
- **Task 16** — `ExerciseSwapModal.tsx`.
- **Task 17** — `ShareActionsBar.tsx` + Save flow + print stylesheet in `globals.css`.
- **Task 18** — `/beatdown/[short_id]` saved view (server page + client wrapper). `BeatdownSection` reused in read-only mode.

### Chunk 5 surface: Task 19
- **Task 19** — Add Beatdown Builder link to Navbar; add a homepage CTA card linking to `/beatdown-builder`.

### Chunk 6: Tests + verification (Tasks 20–21)
- **Task 20** — Playwright E2E spec at `tests/beatdown-builder.spec.ts` + `tests/fixtures/beatdown.ts`. Mock `/api/beatdown/generate` and assert form → render. Plus 404 path.
- **Task 21** — Manual smoke: real Gemini call, real Slack copy, real print preview, manual admin knowledge build trigger.

### Chunk 7: Deploy (Task 22)
- **Task 22** — `npx tsc --noEmit && npm run build` → push feature → PR to `develop` → review preview → promote develop → main → verify production. Update `feature-status.md` from "In Design" → "Complete".

---

## Things to watch out for in remaining tasks

### Task 8 (Generate API)
- The Neon driver may cold-start (~500ms-1s on first call). Combined with Gemini latency this could approach the AMA assistant pattern. Plan budgets ≤8s end-to-end.
- `buildBeatdownContext` now uses `Promise.all` — keep that when adapting code from the plan; the plan's snippet predates the fix.
- Use `responseMimeType: 'application/json'` in the Gemini config — this should produce clean JSON without fences (the `parseResponse` defensive layer is still useful but rarely fires).
- Validate `ao_id` against `ao_channels` server-side. Server re-fetches `ao_display_name` to prevent client spoofing.

### Task 13 (Reconcile integration)
- The reconcile route already handles bot-posted backblasts via metadata.event_type detection (per project memory). Don't break that. Just append the knowledge build at the end of the success path inside try/catch.
- Add `SKIP_BD_KNOWLEDGE=1` env-var escape hatch for cases where you want reconcile without the rebuild (e.g., during incident debugging).

### Task 14–18 (UI)
- Each early UI task will have unresolved imports until later UI tasks finish. **Don't try to make `npx tsc --noEmit` clean after each task in this chunk — wait until Task 17 to verify the full chunk compiles.** This is documented in the plan's heads-up note.
- Tailwind v4 is the project's CSS framework. Match existing component patterns from `src/components/ui/` (e.g., `Card.tsx`, `Button.tsx`, `Hero.tsx`).
- Print styles go in `src/app/globals.css` under `@media print` block.

### Task 19 (surface)
- Read `src/components/layout/Navbar.tsx` first to find the existing nav-link pattern. Don't invent a new one.

### Task 22 (deploy)
- Pre-push verification: `npx tsc --noEmit && npm run build` must pass.
- Pushes to `feature/ai-beatdown-builder` do NOT trigger Vercel builds (deploymentEnabled in `vercel.json` is `develop` + `main` only). One build per merge to `develop`, one more per merge to `main`.
- Update `.claude/context/feature-status.md` to flip "AI Beatdown Builder" status from "In Design" to "Complete".

---

## Open concerns / lessons learned

1. **Exicon size is smaller than expected.** ~70 entries, not the 2000 the architecture notes implied. The Lexicon CSV is large but most entries are F3 vocabulary (Lexicon), not exercises (Exicon). Filter behavior verified — focus-relevant exercises come first, backfill with the rest. Acceptable for v1.

2. **Two real bugs caught by code review** — both in Task 5 originally:
   - `stripCodeFences` regex didn't handle trailing newlines (would have broken every well-formed Gemini response at runtime)
   - `labelTheme` produced `Fng Friendly` instead of `FNG-friendly` (visible to users in Slackblast output)
   Both fixed. The pattern: the implementer subagent passed self-review and produced code matching the spec, but the code reviewer agent caught real edge cases. Keep the two-stage review discipline.

3. **One real bug caught in Task 7**: fallback duplicate-rows when AO query returned 1-4 rows. Fixed via `seenIds` Set.

4. **Implementers occasionally claim "manual verification" instead of running the verification command.** Have the spec reviewer actually re-run the smoke test rather than trusting the implementer's pasted output. (Caught at least one case where output was paraphrased.)

5. **Vercel Hobby cron limit (2/day)** drove the architecture to piggyback knowledge build on `/api/slack/reconcile` instead of adding a dedicated cron. This is documented in the spec; the plan reflects it.

6. **Branch hygiene reminder:** All work on `feature/ai-beatdown-builder`. Don't accidentally land on main. The first commit (Task 1's predecessor — the spec commit) was originally written to main and had to be moved. Lesson: always `git checkout -b feature/...` at session start.

---

## Quick command reference

```bash
# Verify state at session start
git checkout feature/ai-beatdown-builder
git log origin/main..HEAD --oneline | wc -l   # 11
npx tsc --noEmit                                # clean

# Run static helpers (no DB needed)
npx tsx -e "
import { loadFamousBeatdowns } from './src/lib/beatdown/loadFamousBeatdowns';
import { filterExiconForFocus } from './src/lib/beatdown/exicon';
console.log('BDs:', loadFamousBeatdowns().length);
console.log('Exicon legs:', filterExiconForFocus('legs').length);
"

# Run live-DB context build
npx tsx -e "
import { config } from 'dotenv'; config({ path: '.env.local' });
import { buildBeatdownContext } from './src/lib/beatdown/buildContext';
const r = await buildBeatdownContext({ ao_id:'x', ao_display_name:'The Battlefield', focus:'full' as const, theme:null, equipment:['bodyweight' as const], famous_bd:null, q_notes:'' });
console.log(r);
"

# Pre-push gate (run before any push to develop/main)
npx tsc --noEmit && npm run build
```

---

## TODO at session resume

1. Read this handoff and confirm the resume command in the new session.
2. Invoke `superpowers:subagent-driven-development` skill.
3. Open the plan file and copy "Task 8" verbatim into a new implementer subagent prompt.
4. Continue through Tasks 8 → 22 in sequence.

End of handoff.
