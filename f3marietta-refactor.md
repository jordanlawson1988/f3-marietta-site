# F3 Marietta — Architecture & UX Refactor Plan

> **Evaluated:** 2026-02-19
> **Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4, Supabase PostgreSQL, OpenAI, Slack API
> **Skills Applied:** solution-architecture, frontend-ux-design

---

## Executive Summary

F3 Marietta is a community website built with a modern stack serving two core user personas: **prospective members** (FNGs looking to join) and **existing PAX** (members checking backblasts). The site also has a Slack-integrated backblast ingestion pipeline and an AI-powered assistant.

The codebase is functional and clean for an early-stage project, but it has accumulated **significant technical debt** through hardcoded data, inconsistent patterns, a legacy dual-write database strategy, and several UX flows that create friction for the primary user journey: **getting a newcomer to their first workout**. There are also security concerns (XSS, unprotected admin, service role key usage) that need attention before scaling.

---

## Part 1: Solution Architecture Assessment

### Strengths

1. **Clean separation of concerns** — Server Components for data fetching, Client Components only where interactivity is needed
2. **Canonical data model migration** — The `f3_events` table with the dual-write to legacy `backblasts` shows thoughtful migration planning
3. **Slack integration architecture** — Signature verification, bot message parsing, and channel allowlisting are well-implemented
4. **Lazy Supabase client via Proxy** — Elegant pattern that avoids initialization errors during build

### Areas of Concern (Prioritized by Severity)

#### CRITICAL — Security

| # | Finding | File(s) |
|---|---------|---------|
| 1 | **XSS via `dangerouslySetInnerHTML`** — `content_html` is rendered directly from the database (sourced from Slack messages). While `sanitize-html` is a dependency, it's not applied at render time. Any malicious Slack message content would execute in the browser. | `src/app/backblasts/[id]/page.tsx:157` |
| 2 | **Contact form HTML injection** — `${message.replace(/\n/g, '<br />')}` and `${name}` are interpolated directly into HTML email body without sanitization. An attacker could inject arbitrary HTML/scripts into emails sent to your Google Group. | `src/app/api/contact/route.ts:31` |
| 3 | **Service Role Key for all queries** — The Supabase client uses the service role key (bypasses RLS) for everything, including public-facing read queries. If any injection path exists, it has full database access. | `src/lib/supabase.ts` |
| 4 | **Admin KB auth via plaintext password in localStorage** — The admin panel uses a simple password comparison via `x-admin-token` header. No session management, no rate limiting, no CSRF protection. The token is stored in localStorage indefinitely. | `src/app/admin/kb/page.tsx:84,113` |
| 5 | **Search query injection** — The `search` parameter is interpolated directly into a `.or()` filter string. While Supabase's PostgREST layer provides some protection, this pattern is fragile and could be exploited with specially crafted input. | `src/lib/backblast/getBackblastsPaginated.ts:71` |

#### HIGH — Architectural Debt

| # | Finding | File(s) |
|---|---------|---------|
| 6 | **~260 lines of hardcoded workout data** — The entire workout schedule is a static JavaScript object inside a `"use client"` component. Schedule changes require a code deploy, data can't be managed by non-developers, and it's the single largest file in the app mixing data with UI. | `src/app/workouts/page.tsx:30-291` |
| 7 | **Legacy dual-write still active** — The Slack events handler writes to both `f3_events` AND `backblasts` tables on every message. The backblasts page now reads exclusively from `f3_events`. The legacy table and dual-write code should be removed. | `src/app/api/slack/events/route.ts` |
| 8 | **No middleware.ts** — No Next.js middleware means no global auth checks, no CSP headers, no rate limiting at the edge. Admin routes rely entirely on client-side password checks. | (missing file) |
| 9 | **GPT-3.5-turbo for AI assistant** — Older, less capable model. For a knowledge retrieval task, Claude Haiku 4.5 or GPT-4o-mini would provide better answers at similar cost. `max_tokens: 250` is also quite restrictive. | `src/app/api/assistant/route.ts:122` |
| 10 | **No error boundaries or loading states** — No error boundaries around Supabase queries. A database outage would show an unhandled error page. No Suspense boundaries or skeleton screens. | Multiple pages |

#### MEDIUM — Code Quality

| # | Finding | File(s) |
|---|---------|---------|
| 11 | **`any` types in admin KB page** — Multiple `any` types undermine TypeScript's value. | `src/app/admin/kb/page.tsx:24,25,107,443` |
| 12 | **No RLS policies visible** — Migrations create tables but don't show RLS policies. Combined with service role key usage, the database is essentially unprotected. | `supabase/migrations/` |
| 13 | **Commented-out code** — Commented-out lucide imports replaced with SVG icons. | `src/app/community/page.tsx:26-28,46-48,65-67` |
| 14 | **Inconsistent image handling** — Some pages use `next/image` (with priority/fill), others use raw `<img>` tags, bypassing Next.js image optimization. | `src/app/page.tsx:134`, `src/app/community/page.tsx:98-99` |
| 15 | **OpenAI client instantiated per request** — A new OpenAI client is created on every API call instead of being a module-level singleton. | `src/app/api/assistant/route.ts:108` |
| 16 | **`relatedPages` typed as `any[]`** — Defeats TypeScript. | `src/app/api/assistant/route.ts:221` |

### Database Assessment

- **Schema design is solid** — Normalized child tables, proper unique constraints, soft deletes
- **Missing indexes** — No explicit indexes on `event_date`, `event_kind`, or `ao_display_name` in the migrations
- **No database-level validation** — No CHECK constraints on `event_kind` (should be `CHECK (event_kind IN ('backblast', 'preblast', 'unknown'))`)

### Deployment & Operations

- **No CI/CD checks** — `.github/workflows/ci.yml` appears to have been deleted
- **No staging environment** — Deploys go directly from `main` to production via Vercel
- **Cron jobs lack authentication** — The Vercel cron endpoints have a `CRON_SECRET` env var referenced but enforcement isn't visible in route handlers

---

## Part 2: Frontend & UX Evaluation

### User Journey Analysis

The primary user journey is: **Man hears about F3 → Visits website → Finds workout near him → Shows up**

#### Current Flow (Too Many Steps)

1. Lands on homepage → reads about F3 → clicks "Find a Workout"
2. Arrives at `/workouts` → sees hero (duplicate "WORKOUT SCHEDULE" heading) → scrolls past hero → finds workout schedule
3. Must understand the Marietta/West Cobb/Other Nearby taxonomy
4. Must expand accordion (mobile) or scan 7-column grid (desktop) to find a workout
5. Clicks "Directions" external link

**That's 5+ steps with significant cognitive load.** The optimal journey should be 2-3 steps max.

### UX Issues (Prioritized)

#### HIGH — Information Architecture

| # | Finding | File(s) |
|---|---------|---------|
| 1 | **Navigation overload (9 items + CTA)** — 10 total items, nearly double the recommended 4-7. Consolidation opportunities: "FAQ" + "What to Expect" → "New Here?"; "F3 Terms" → footer; "Community" → fold into About; "F3 Gear" → footer. | `src/components/layout/Navbar.tsx:9-19` |
| 2 | **Duplicate content across pages** — "What is F3" explanation appears on homepage, about page, FAQ page, and AI KB. "5 Core Principles" on homepage. "Just show up" on 4+ pages. Dilutes message and creates maintenance burden. | Multiple pages |
| 3 | **"Backblasts" serves existing PAX only** — 5th nav item but meaningless to newcomers (the primary conversion target). Should be lower priority in navigation. | `src/components/layout/Navbar.tsx:14` |
| 4 | **Contact page is a dead end** — Shows email and social links but has no actual contact form, despite having a Resend-powered `/api/contact` route built but never wired up to the UI. | `src/app/contact/page.tsx` |

#### HIGH — Visual Design

| # | Finding | File(s) |
|---|---------|---------|
| 5 | **Workout schedule readability (desktop)** — 7-column grid with `text-[10px]` and `text-[9px]` font sizes is extremely hard to read. Below WCAG minimum for the 9px address text. | `src/app/workouts/page.tsx:307,328` |
| 6 | **Mobile menu uses text "Menu" / "X"** instead of proper hamburger/X icons. Unconventional and misses universally-understood icon pattern. | `src/components/layout/Navbar.tsx:67-68` |
| 7 | **Hero sections are redundant** — Workouts page hero says "WORKOUT SCHEDULE" followed by `<h2>` also saying "WORKOUT SCHEDULE". Heroes consume above-the-fold space without adding information. | `src/app/workouts/page.tsx:448-453,458` |
| 8 | **No skeleton/loading states** — Backblasts page uses `force-dynamic` with zero loading UI. On slow connections, users see blank page until Supabase responds. | `src/app/backblasts/page.tsx:7-8` |

#### MEDIUM — Interaction Design

| # | Finding | File(s) |
|---|---------|---------|
| 9 | **Backblast search is form-submit only** — Users must type a query then click "Search". No debounced live filtering, no typeahead. | `src/app/backblasts/page.tsx:112-149` |
| 10 | **AI Assistant is single-turn only** — One question, one answer, no follow-up. Each interaction is stateless. | `src/components/ui/AssistantWidget.tsx` |
| 11 | **FAQ accordion has no "expand all" or search** — With 40+ FAQ items, users must click each one individually. | `src/app/fng/page.tsx:61-65` |
| 12 | **Glossary page has no deep linking** — AI assistant generates `#hash` links to glossary entries, but glossary page doesn't scroll to or highlight matched terms. | `src/app/glossary/page.tsx` |
| 13 | **"What to Expect" embeds 4 YouTube iframes** — On mobile, this loads significant third-party JavaScript. No lazy loading, no click-to-play pattern. | `src/app/what-to-expect/page.tsx:24-41` |

#### LOW — Polish & Consistency

| # | Finding | File(s) |
|---|---------|---------|
| 14 | **Inconsistent CTA button styles** — Homepage CTA uses inline Tailwind with hardcoded hover color, "What to Expect" CTA uses raw `<a>` tag with manual button styling, other pages use `<Button>` component. | `src/app/page.tsx:145`, `src/app/what-to-expect/page.tsx:68-73` |
| 15 | **Contact page uses emoji icons** (📧, 📱) in `CardTitle` while rest of site uses lucide-react icons. Emoji rendering varies across platforms. | `src/app/contact/page.tsx:25,41` |
| 16 | **No OG meta for social sharing** — Metadata is minimal (title + description only). No Open Graph images, no Twitter cards. Missed opportunity for social sharing of a community-recruiting website. | `src/app/layout.tsx:15-18` |
| 17 | **`ReleaseNotes` modal on every page** — "What's new" modal loads on every page visit. Pattern is usually reserved for SaaS products, not community websites. | `src/app/layout.tsx:41` |

---

## Part 3: Refactoring & Redesign Recommendations

### Priority 1 — Security Fixes (Do First)

| # | Action | Effort | Files |
|---|--------|--------|-------|
| 1 | Sanitize `content_html` before rendering with `sanitize-html` | Small | `src/app/backblasts/[id]/page.tsx` |
| 2 | Sanitize contact form inputs before HTML email interpolation | Small | `src/app/api/contact/route.ts` |
| 3 | Create a read-only Supabase client (anon key + RLS) for public queries | Medium | `src/lib/supabase.ts`, new RLS policies |
| 4 | Add rate limiting to `/api/assistant` and `/api/contact` | Medium | API route files |
| 5 | Add `middleware.ts` with CSP headers and admin route protection | Medium | New `src/middleware.ts` |

### Priority 2 — UX Redesign for Conversion

| # | Action | Impact | Files |
|---|--------|--------|-------|
| 1 | Consolidate nav to 5-6 items: Home, About, Workouts, Backblasts, New Here? (merges FAQ + What to Expect), Contact | High | `Navbar.tsx`, `Footer.tsx`, route consolidation |
| 2 | Move workout schedule to Supabase and build "Find nearest workout" experience with day-of-week default-expanded | High | `workouts/page.tsx`, new Supabase table |
| 3 | Replace hero + duplicate heading pattern with single purpose-built page headers | Medium | `Hero.tsx`, all page files |
| 4 | Wire up contact form UI to existing `/api/contact` route | Medium | `src/app/contact/page.tsx` |
| 5 | Add OG meta images and social sharing cards | Medium | `src/app/layout.tsx`, page metadata |
| 6 | Lazy-load YouTube iframes with click-to-play thumbnails | Small | `src/app/what-to-expect/page.tsx` |

### Priority 3 — Technical Debt Reduction

| # | Action | Effort | Files |
|---|--------|--------|-------|
| 1 | Remove legacy `backblasts` table dual-write and deprecated code | Medium | `api/slack/events/route.ts`, `lib/backblast/parseBackblast.ts`, `types/backblast.ts` |
| 2 | Extract workout schedule data from component into Supabase table | Medium | `src/app/workouts/page.tsx` |
| 3 | Add loading states (Suspense boundaries + skeleton screens) for backblasts | Small | `src/app/backblasts/` |
| 4 | Replace `<img>` tags with `next/image` throughout | Small | `src/app/page.tsx`, `src/app/community/page.tsx` |
| 5 | Fix all `any` types in admin KB page | Small | `src/app/admin/kb/page.tsx` |
| 6 | Remove commented-out code throughout | Small | `src/app/community/page.tsx` |
| 7 | Add database indexes on frequently-queried columns | Small | New migration |
| 8 | Restore CI pipeline (linting + Playwright on PR) | Medium | `.github/workflows/ci.yml` |

### Priority 4 — Feature Enhancement

| # | Action | Impact | Files |
|---|--------|--------|-------|
| 1 | Upgrade AI model from GPT-3.5-turbo to GPT-4o-mini or Claude Haiku | Medium | `src/app/api/assistant/route.ts` |
| 2 | Add search within FAQ page | Small | `src/app/fng/page.tsx` |
| 3 | Implement debounced live search on backblasts page | Medium | `src/app/backblasts/page.tsx` |
| 4 | Add proper hamburger menu icon on mobile | Small | `src/components/layout/Navbar.tsx` |

---

## Recommended Execution Order

Following SDLC workflow axioms:

1. **Branch from `main`** — Create `feature/architecture-cleanup`
2. **Security fixes first** — Critical path, small scope, high impact
3. **UX redesign as separate PR(s)** — Nav consolidation, workout page redesign
4. **Tech debt cleanup** — Chunk into smaller PRs
5. **Review at each stage** on Vercel preview before merging to production
