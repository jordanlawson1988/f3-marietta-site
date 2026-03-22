# /context-refresh — Refresh All Living Context Files

Re-read the current state of the project and update all `.claude/context/` files to reflect reality. Run this when context files are stale or at the start of a new session.

## Step 1: Refresh Test Health

If Playwright can run (browser binaries installed):
```bash
cd ~/Projects/f3-marietta && npx playwright test --project=chromium --reporter=list 2>&1
```

Parse results and rewrite `.claude/context/test-health.md` following the established format. Include:
- Test file inventory with counts
- Pass/fail results
- Any failing test details
- Production gate status

If Playwright cannot run, note the reason in test-health.md and update the "Last updated" timestamp.

## Step 2: Refresh Feature Status

Read the current routes and admin pages, then compare against `.claude/context/feature-status.md`:

1. Check for new routes in `src/app/` that aren't in the feature tracker
2. Check for new API routes in `src/app/api/`
3. Check for new admin pages in `src/app/admin/`
4. Update feature statuses if any have changed
5. Update the route inventory

## Step 3: Refresh Architecture Notes

### Dependencies
Read `package.json` and compare against the dependency versions listed in `.claude/context/architecture-notes.md`. Update any that have changed.

### Tech Debt
Scan for new tech debt:
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" src/ | head -30
```

Update the tech debt table:
- Add new items discovered
- Remove items that have been resolved
- Update severity if conditions changed

### Infrastructure
Verify infrastructure details are still accurate (Vercel plan, Neon status, etc.)

### Migrations
Count migrations and check for new ones:
```bash
ls supabase/migrations/*.sql | wc -l
```

## Step 4: Refresh Business Context

Read `.claude/context/business-context.md` and verify it's still accurate. This file changes rarely — only update if:
- New community features added
- Stakeholder changes
- Content sources changed

If no changes are needed, just update the "Last updated" timestamp.

## Step 5: Output Refresh Report

```
==================================================
            CONTEXT REFRESH COMPLETE
==================================================

  Files Updated:
    test-health.md        [UPDATED / NO CHANGE]
    feature-status.md     [UPDATED / NO CHANGE]
    architecture-notes.md [UPDATED / NO CHANGE]
    business-context.md   [UPDATED / NO CHANGE]

  Key Changes:
    - [bullet list of notable changes, or "All files were current"]

  Staleness Before Refresh:
    [which files were stale and by how many days]

  All context files now reflect project state as of [DATE].

==================================================
```

## Important
- This command ONLY updates `.claude/context/` files — it does not modify source code
- If a context file doesn't exist, create it following the patterns of existing ones
- Always update the "Last updated" date in each file's header
- If tests fail to run (build error, missing deps), note the failure in test-health.md rather than leaving it stale
