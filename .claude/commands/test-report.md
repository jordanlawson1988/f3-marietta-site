# /test-report — Run Tests and Update Health Snapshot

Run the Playwright E2E test suite and update the persistent test health file so future sessions have accurate test status.

## Step 1: Run E2E Tests

```bash
cd ~/Projects/f3-marietta && npx playwright test --project=chromium --reporter=list 2>&1
```

Capture the full output including pass/fail counts and any error messages. If browser binaries are not installed, run `npx playwright install chromium` first.

If the dev server is already running on port 3000, the test will use it. Otherwise, Playwright will start one automatically.

## Step 2: Analyze Results

Parse the output to extract:
- Total test count, passed, failed, skipped
- Total test files tested
- For each failing test: the error message, file, and test name
- For each passing file: test count

## Step 3: Update Test Health File

Write the results to `.claude/context/test-health.md` with this structure:

```markdown
# Test Health — F3 Marietta

> Auto-updated snapshot of test suite status. Last updated: [TODAY'S DATE]

## E2E Tests (Playwright)

### Configuration
[framework, directory, projects, CI config]

### Test Files
[Table of test files with counts and coverage areas]

### Results (Chromium)
| Metric | Count |
|--------|-------|
| **Passed** | [N] |
| **Failed** | [N] |
| **Skipped** | [N] |
| **Total** | [N] |

### Failing Tests
[For each failing test: file, test name, error message]

## Unit Tests
**No unit test framework configured.**

## Production Gate
[Whether the CI checks (lint + build + Playwright) currently pass]
```

## Step 4: Report

Output a brief summary:
- Pass/fail ratio
- Whether CI checks would pass
- Any new failures since the last snapshot (compare with previous `.claude/context/test-health.md`)

## Important
- Do NOT fix test failures — just report them
- Compare against the previous test-health.md to identify regressions
- If all tests pass, confirm the production gate is clear
- If Playwright cannot run (missing binaries, port conflict), note it in test-health.md
