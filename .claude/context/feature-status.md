# Feature Status — F3 Marietta

> Living tracker of feature progress and completeness. Last updated: 2026-03-22

## Feature Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Homepage | Complete | Hero, What is F3, Who is F3 Marietta, 5 Core Principles, CTA |
| About Page | Complete | Region story, mission, community info |
| Workouts Schedule | Complete | Dynamic from DB, region filtering, day-of-week highlighting |
| Backblasts | Complete | Slack ingestion, list with pagination, detail view |
| AI Assistant (AMA) | Complete | Floating widget, glossary lookup, OpenAI fallback, rate limited |
| Glossary (Lexicon/Exicon) | Complete | 353K CSV, searchable, linked from assistant |
| Contact Page | Complete | Contact form via Resend |
| New Here / FNG / What to Expect | Complete | Onboarding pages for new PAX |
| Community Page | Complete | Community info and links |
| Admin Dashboard | Complete | Authenticated layout, sidebar nav, login screen |
| Admin Workout Manager | Complete | CRUD for workout schedule, region management, calendar grid |
| Admin Region Manager | Complete | CRUD for regions, sort order, primary/active flags |
| Admin Knowledge Base | Complete | File management for AI assistant knowledge docs |
| Instagram Automation | Complete | AI-generated captions from backblasts, approve/reject/edit flow |
| Newsletter Automation | Complete | AI-generated weekly newsletters, Slack publishing |
| Slack Integration | Complete | Event ingestion, user sync, daily reconciliation |
| Authentication (Better Auth) | Complete | Email/password, session management, middleware cookie check |

## Route Inventory

### Public Pages (11)
- `/` — Homepage
- `/about` — About F3 Marietta
- `/workouts` — Dynamic workout schedule
- `/backblasts` — Paginated backblast list
- `/backblasts/[id]` — Individual backblast detail
- `/glossary` — Lexicon/Exicon search
- `/contact` — Contact form
- `/new-here` — New PAX guide
- `/fng` — FNG (Friendly New Guy) info
- `/what-to-expect` — What to expect at a workout
- `/community` — Community info

### Admin Pages (7)
- `/admin` — Redirects to `/admin/workouts`
- `/admin/workouts` — Workout schedule manager (calendar grid)
- `/admin/regions` — Region CRUD
- `/admin/kb` — Knowledge base file manager
- `/admin/drafts` — Pending Instagram drafts
- `/admin/drafts/history` — Draft history (approved/rejected/posted)
- `/admin/newsletter` — Newsletter management

### API Routes (23)
- `/api/auth/[...all]` — Better Auth catch-all handler
- `/api/assistant` — AI assistant (OpenAI + glossary)
- `/api/contact` — Contact form submission
- `/api/slack/events` — Slack event webhook (backblast/preblast ingestion)
- `/api/slack/reconcile` — Daily Slack data reconciliation (cron)
- `/api/slack/sync-users` — Daily Slack user profile sync (cron)
- `/api/cron/generate-drafts` — Generate Instagram drafts from backblasts (cron)
- `/api/cron/generate-newsletter` — Generate weekly newsletter (cron)
- `/api/admin/workouts` — Workout CRUD (GET, POST)
- `/api/admin/workouts/[id]` — Workout update/delete (PUT, DELETE)
- `/api/admin/workouts/bulk` — Bulk workout operations
- `/api/admin/regions` — Region CRUD (GET, POST)
- `/api/admin/regions/[id]` — Region update/delete (PUT, DELETE)
- `/api/admin/drafts` — Instagram draft list (GET)
- `/api/admin/drafts/[id]` — Draft detail/update (GET, PUT)
- `/api/admin/drafts/[id]/approve` — Approve draft (POST)
- `/api/admin/drafts/[id]/regenerate` — Regenerate draft with Claude (POST)
- `/api/admin/drafts/[id]/reject` — Reject draft (POST)
- `/api/admin/kb/files` — Knowledge base file list (GET)
- `/api/admin/kb/file` — Knowledge base file upload/delete
- `/api/admin/newsletter` — Newsletter list/create (GET, POST)
- `/api/admin/newsletter/[id]` — Newsletter detail/update (GET, PUT)
- `/api/admin/newsletter/[id]/approve` — Approve and post newsletter (POST)

## Data Flows

### Backblast Pipeline
1. PAX posts workout recap in Slack AO channel
2. F3 Nation bot formats it as a backblast message with metadata
3. Slack Events API sends webhook to `/api/slack/events`
4. App verifies signature, normalizes message, upserts to `f3_events`
5. Child records (attendees, Qs, blocks) are upserted
6. Backblasts page is revalidated
7. (Cron) `generate-drafts` creates Instagram caption draft via Claude
8. Admin reviews/approves draft in dashboard

### Newsletter Pipeline
1. (Cron) `generate-newsletter` queries recent backblasts
2. Claude generates newsletter content in Slack mrkdwn format
3. Admin reviews/edits in dashboard
4. On approve, newsletter is posted to Slack channel via `postNewsletter()`

### AI Assistant Flow
1. User types question in floating widget
2. Direct glossary match check (Lexicon/Exicon) — instant response if found
3. Otherwise: knowledge base context retrieval + OpenAI `gpt-4o-mini` call
4. Response includes related glossary entries and page links

## Potential Future Work
- Automated Slack posting of Instagram drafts (currently manual)
- Event attendance tracking/analytics
- PAX leaderboard from backblast data
- Preblast notifications
- Multi-region support (out of scope per planning agent)
