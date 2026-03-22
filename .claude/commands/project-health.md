# /project-health — Comprehensive Project Health Dashboard

Deep health assessment across all project dimensions. More thorough than `/status-check` — use this for periodic check-ins or before major milestones.

## Step 1: Gather All Data (run in parallel where possible)

### Git Health
- `git log --oneline -20` — recent commit history
- `git branch -a` — all branches (local + remote)
- `git branch --merged main` — branches safe to clean up
- `git stash list` — stashed work
- `git log --oneline --since="7 days ago" | wc -l` — weekly commit velocity
- Check for divergence between local and remote branches

### Build Health
```bash
cd ~/Projects/f3-marietta && npm run build 2>&1
```
Capture full output. Note any warnings (not just errors).

### Test Health
```bash
cd ~/Projects/f3-marietta && npx playwright test --project=chromium --reporter=list 2>&1
```
If Playwright cannot run, note the reason. Update `.claude/context/test-health.md` with fresh data.

### Dependency Health
```bash
cd ~/Projects/f3-marietta && npm outdated 2>&1
```
Categorize outdated packages:
- **Critical:** Major version behind (breaking changes likely)
- **Moderate:** Minor version behind
- **Low:** Patch version behind

### Code Quality
```bash
cd ~/Projects/f3-marietta && npm run lint 2>&1
```
Count lint warnings and errors.

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" ~/Projects/f3-marietta/src/ | wc -l
```
Total TODO/FIXME count.

### Migration Health
- Count total migrations: `ls ~/Projects/f3-marietta/supabase/migrations/*.sql | wc -l`
- Check for schema drift or unapplied changes

### File Metrics
- `find ~/Projects/f3-marietta/src -name "*.ts" -o -name "*.tsx" | wc -l` — total source files
- Check for unusually large files (>500 lines)

## Step 2: Output Dashboard

```
============================================================
                  PROJECT HEALTH REPORT
                     F3 Marietta
                     [DATE]
============================================================

  GIT
  ----------------------------------------------------------
  Branch:          [current branch]
  Commits (7d):    [N]
  Total branches:  [N] local, [N] remote
  Stale branches:  [list any merged branches to clean up]
  Stashed work:    [N] stashes
  Uncommitted:     [clean / N files modified]

  BUILD
  ----------------------------------------------------------
  Status:          [PASS / FAIL]
  Warnings:        [N]

  TESTS
  ----------------------------------------------------------
  E2E (Chromium):  [N] passed, [N] failed
  Unit:            No unit test framework
  CI Gate:         [CLEAR / BLOCKED — reason]

  DEPENDENCIES
  ----------------------------------------------------------
  Outdated:        [N] critical, [N] moderate, [N] patch
  Notable:         [list any critical outdated packages]

  CODE QUALITY
  ----------------------------------------------------------
  Lint errors:     [N]
  Lint warnings:   [N]
  TODO/FIXME:      [N] across codebase
  Source files:    [N] (.ts/.tsx)
  Large files:     [list any >500 lines]

  DATABASE
  ----------------------------------------------------------
  Migrations:      [N] total
  Schema file:     scripts/neon-schema.sql ([N]KB)

  FEATURES
  ----------------------------------------------------------
  Total features:  [N] complete, [N] in progress
  Public routes:   [N]
  Admin routes:    [N]
  API routes:      [N]

  TECH DEBT
  ----------------------------------------------------------
  [Table from architecture-notes.md, refreshed]

============================================================

  RECOMMENDATIONS
  ----------------------------------------------------------
  [Prioritized list of actions based on findings]

============================================================
```

## Step 3: Update Context Files

After gathering all this data, update the relevant `.claude/context/` files:
- `test-health.md` — with fresh test results
- `architecture-notes.md` — with dependency versions and tech debt changes

## Important
- This is a read-only + context-update command — do not fix issues, just report them
- Prioritize recommendations by impact: blockers first, then high-severity debt, then housekeeping
- If any step times out (especially build), note it and continue with other checks
- Expected runtime: 2-5 minutes depending on build/test speed
