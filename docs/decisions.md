# Architectural Decision Records — F3 Marietta

> Append-only log of significant technical and architectural decisions. New decisions go at the bottom. Never edit or remove past entries — they serve as historical context.

---

## How to Add a Decision

Copy the template below and append it to the end of this file:

```markdown
### ADR-[NNN]: [Title]
**Date:** YYYY-MM-DD
**Status:** Accepted / Superseded by ADR-NNN / Deprecated
**Context:** What situation prompted this decision?
**Decision:** What did we decide?
**Consequences:** What are the trade-offs? What does this enable or prevent?
```

---

## Decisions

### ADR-001: Dark Navy Theme (Single Dark Mode)
**Date:** 2025-11 (retroactive)
**Status:** Accepted
**Context:** Needed a visual identity for the F3 Marietta website. F3 workouts happen in "the gloom" (early morning darkness), and the community embraces this aesthetic.
**Decision:** Enforce a single dark navy theme (`#050914` background, `#4A76A8` primary accent) globally. No light/dark toggle. CSS variables in `:root` serve as the single source of truth.
**Consequences:** Simpler CSS (no media query overrides for color scheme). Strong brand alignment with F3's "gloom" identity. May reduce accessibility for users who prefer light mode, but acceptable for the target audience.

### ADR-002: Supabase to Neon + Better Auth Migration
**Date:** 2026-03-19
**Status:** Accepted
**Context:** Supabase introduced complexity for a project of this size — RLS policies, service role keys, and client libraries were overkill. Neon offers simpler serverless Postgres with better cold-start performance.
**Decision:** Migrate from Supabase (database + auth) to Neon serverless Postgres + Better Auth (open source auth library). Full migration completed in a single branch.
**Consequences:** Simpler database access via `@neondatabase/serverless` tagged-template queries. No RLS policies to manage. Better Auth stores sessions in Neon directly. Lost Supabase Realtime (not needed for this project). Previous Supabase client code fully removed. Migration files retained in `supabase/migrations/` for historical reference.

### ADR-003: Lazy-Initialized Database Client
**Date:** 2026-03-19
**Status:** Accepted
**Context:** Neon's serverless driver requires a `DATABASE_URL` at initialization time. During Next.js builds, env vars may not be available, causing build failures.
**Decision:** Use a lazy-initialized singleton pattern (`getSql()`) that only creates the Neon client on first use, not at import time.
**Consequences:** Build succeeds without `DATABASE_URL` as long as no database call happens at build time. The `workouts` page requires `export const dynamic = 'force-dynamic'` to prevent build-time DB access. Error surfaces on first database call rather than at import time — acceptable trade-off.

### ADR-004: OpenAI for Public Assistant, Anthropic for Automation
**Date:** 2026-01 (retroactive)
**Status:** Accepted
**Context:** Two distinct AI use cases: (1) public-facing AMA widget that answers F3 questions in real-time, and (2) backend automation that generates Instagram captions and newsletters from backblast data.
**Decision:** Use OpenAI `gpt-4o-mini` for the public assistant (low cost, fast response) and Anthropic Claude `claude-sonnet-4-20250514` for automation tasks (higher quality structured output for captions/newsletters).
**Consequences:** Two API keys to manage. Two different SDKs (`openai` and `@anthropic-ai/sdk`). The assistant route uses OpenAI's chat completion API; the automation routes use Anthropic's messages API with JSON parsing. Cost is minimal given low volume.

### ADR-005: In-Memory Rate Limiting
**Date:** 2026-03 (retroactive)
**Status:** Accepted
**Context:** The AI assistant endpoint is public and could be abused. Needed rate limiting without adding Redis or external dependencies.
**Decision:** In-memory sliding window rate limiter in `lib/security/rateLimiter.ts`. 10 requests per minute per IP for the assistant route. Periodic cleanup of expired entries.
**Consequences:** Rate limits reset on serverless function cold starts. Not shared across Vercel instances. Adequate for current traffic (~50-100 active PAX). If traffic scales significantly, would need Redis or Vercel KV.

### ADR-006: Slack Events API for Backblast Ingestion
**Date:** 2026-01 (retroactive)
**Status:** Accepted
**Context:** F3 Marietta PAX post backblasts in Slack channels after each workout. Need to automatically capture these and display on the website.
**Decision:** Use Slack Events API with a webhook endpoint (`/api/slack/events`). Verify HMAC signatures, normalize messages, and upsert to `f3_events` table with idempotent ON CONFLICT handling.
**Consequences:** Backblasts appear on the website automatically without manual entry. The webhook must respond within 3 seconds to avoid Slack retries. Processing is inline (no background jobs on Vercel Hobby). Message edits and deletes are handled via the same webhook. Daily reconciliation cron catches any missed events.

### ADR-007: Canonical F3 Events Data Model
**Date:** 2026-01-08 (retroactive)
**Status:** Accepted
**Context:** Initially stored backblasts in a flat `backblasts` table. Needed to support preblasts, attendee tracking, Q information, and Slack block content.
**Decision:** Created a normalized `f3_events` table as the canonical event store, with child tables for attendees (`f3_event_attendees`), Qs (`f3_event_qs`), and Slack message blocks (`slack_message_blocks`, `slack_block_elements`). Events have `event_kind` discriminator ('backblast' | 'preblast' | 'unknown').
**Consequences:** Richer data model enables future analytics (attendance trends, Q frequency, etc.). More complex upsert logic — child records are deleted and re-inserted on every edit. The original `backblasts` table retained for backward compatibility via a view.

### ADR-008: Better Auth with Lightweight Middleware Cookie Check
**Date:** 2026-03-19
**Status:** Accepted
**Context:** After migrating to Better Auth, needed auth checks in both Edge Runtime (middleware) and Node.js Runtime (API routes). Better Auth's full session validation requires Node.js.
**Decision:** Middleware performs a lightweight cookie-existence check (`request.cookies.has('better-auth.session_token')`) for route protection. Full session validation via `auth.api.getSession()` only happens in API routes (Node.js runtime).
**Consequences:** Middleware is fast and Edge-compatible. A user with an expired session cookie could briefly access admin pages before an API call fails — acceptable since all mutations are protected by full session validation in API routes.

### ADR-009: Consolidated f3-automation into Admin Dashboard
**Date:** 2026-03 (retroactive)
**Status:** Accepted
**Context:** The Instagram automation and newsletter generation started as a standalone project in `f3-automation/`. This created maintenance burden with two codebases sharing the same database.
**Decision:** Consolidated all automation functionality into the main app's admin dashboard. Instagram drafts, newsletter management, and cron jobs now live in the main `src/` directory. The legacy `f3-automation/` directory is preserved but excluded from ESLint.
**Consequences:** Single codebase to maintain. Admin dashboard provides a unified interface for all management tasks. The legacy directory should be cleaned up when convenient.

### ADR-010: Playwright-Only Testing (No Unit Tests)
**Date:** 2025-12 (retroactive)
**Status:** Accepted
**Context:** Needed to establish testing strategy for a community site with primarily UI-facing features. Considered Vitest for unit tests vs. Playwright for E2E.
**Decision:** Use Playwright E2E tests only. No unit test framework. Tests cover navigation, accessibility, content rendering, and widget interactions across 5 browser/device combinations.
**Consequences:** Good coverage of user-facing behavior. No fast-feedback loop for pure functions (glossary search, message normalization, rate limiting). If the codebase grows in complexity, should revisit adding Vitest for utility functions. CI runs Chromium only for speed.
