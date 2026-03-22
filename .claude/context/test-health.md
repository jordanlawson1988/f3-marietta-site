# Test Health — F3 Marietta

> Auto-updated snapshot of test suite status. Last updated: 2026-03-22

## E2E Tests (Playwright)

### Configuration
- **Framework:** Playwright 1.57
- **Test directory:** `tests/`
- **Browser projects:** Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)
- **Web server:** Auto-starts dev server on `localhost:3000` before tests
- **CI:** Chromium only (for speed)

### Test Files (8)

| File | Test Count | Coverage Area |
|------|-----------|---------------|
| `accessibility.spec.ts` | 11 | Landmarks, alt text, headings, links, keyboard nav |
| `admin-workouts.spec.ts` | 10 | Admin sidebar, workout grid, create/edit modals, regions |
| `ama-widget.spec.ts` | 14 | Floating button, panel open/close, input, glossary lookup, mobile |
| `backblasts.spec.ts` | ~15 | Backblasts list, pagination, detail view |
| `glossary.spec.ts` | ~10 | Lexicon/Exicon rendering, search, filtering |
| `homepage.spec.ts` | ~8 | Hero, pillars, CTAs, content sections |
| `navigation.spec.ts` | ~10 | Navbar links, mobile menu, active states |
| `pages.spec.ts` | ~8 | About, Workouts, Community, Contact, New Here |

### Test Status

Tests have not been run in this audit session (Playwright E2E tests require a running dev server and browser binaries). Last known state from CI: passing on Chromium.

## Unit Tests

**No unit test framework is configured.** The project has no Vitest, Jest, or other unit test setup. All testing is done via Playwright E2E.

## Production Gate

Per CLAUDE.md, Playwright E2E tests should pass before merging to `main`. CI workflow runs `npm run lint` and `npm run build` on push/PR, then runs Playwright tests (Chromium only) as a second job.

## Gaps & Recommendations

- No unit tests for utility functions (`normalizeSlackMessage`, `searchGlossary`, `rateLimiter`)
- No integration tests for API routes (Slack events, assistant, cron jobs)
- Admin authentication flow not tested in E2E (tests bypass auth or mock it)
- Newsletter and Instagram draft features have no test coverage
- Consider adding Vitest for fast feedback on pure functions (glossary search, Slack message normalization)
