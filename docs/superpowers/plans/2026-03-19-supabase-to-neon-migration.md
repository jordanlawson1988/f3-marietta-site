# Supabase → Neon + Better Auth Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fully migrate F3 Marietta from Supabase to Neon (database) + Better Auth (authentication), eliminating the Supabase dependency and its monthly cost.

**Architecture:** Replace Supabase client with `@neondatabase/serverless` raw SQL queries. Replace the shared admin password system with Better Auth email/password sessions. No realtime or storage migration needed (not in use).

**Tech Stack:** Neon (serverless Postgres), Better Auth (session auth), @neondatabase/serverless (SQL client)

**Spec:** `docs/supabase-migration-template.md`

---

### Task 1: Install Packages & Create DB Client

**Files:**
- Modify: `package.json`
- Create: `src/lib/db.ts`

- [ ] Install `@neondatabase/serverless` and `better-auth`
- [ ] Create `src/lib/db.ts` with lazy-initialized `getSql()` helper
- [ ] Verify import works

---

### Task 2: Migrate Schema to Neon

**Files:**
- Read: `supabase/migrations/*.sql`
- Create: `scripts/neon-schema.sql` (combined, RLS-free)

- [ ] Combine all migration SQL files in order, removing RLS policies and Supabase-specific security
- [ ] Run combined schema against Neon via `psql $DATABASE_URL`
- [ ] Verify tables exist

---

### Task 3: Migrate Data from Supabase to Neon

**Files:**
- Create: `scripts/migrate-to-neon.ts`

- [ ] Write migration script that reads from Supabase REST API and inserts into Neon
- [ ] Tables to migrate: ao_channels, slack_users, f3_events, f3_event_attendees, f3_event_qs, slack_message_blocks, slack_block_elements, workout_schedule, regions
- [ ] Run migration and verify counts match

---

### Task 4: Set Up Better Auth

**Files:**
- Create: `src/lib/auth.ts` (server config)
- Create: `src/lib/auth-client.ts` (client)
- Create: `src/app/api/auth/[...all]/route.ts`
- Modify: `src/app/admin/layout.tsx` (replace password with Better Auth)
- Modify: `src/app/admin/AdminAuthContext.tsx`
- Modify: `src/lib/admin/auth.ts` (replace token validation with session)
- Remove: `src/app/api/admin/auth/route.ts` (replaced by Better Auth)

- [ ] Create Better Auth server config with Neon pool
- [ ] Create client auth helper
- [ ] Create catch-all auth API route
- [ ] Update admin layout to use Better Auth sign-in
- [ ] Update admin API auth to validate sessions instead of tokens
- [ ] Create seed script for initial admin user

---

### Task 5: Replace Supabase Queries — Library Functions

**Files:**
- Modify: `src/lib/backblast/getBackblastsPaginated.ts`
- Modify: `src/lib/workouts/getWorkoutSchedule.ts`
- Modify: `src/lib/slack/lookupSlackUser.ts`

- [ ] Convert `supabase.from()` queries to `sql` tagged template literals
- [ ] Handle pagination with SQL LIMIT/OFFSET and COUNT
- [ ] Handle dynamic WHERE clauses for search/filter

---

### Task 6: Replace Supabase Queries — Slack API Routes

**Files:**
- Modify: `src/app/api/slack/events/route.ts`
- Modify: `src/app/api/slack/sync-users/route.ts`
- Modify: `src/app/api/slack/reconcile/route.ts`

- [ ] Convert all supabase queries to SQL
- [ ] Handle upserts with ON CONFLICT
- [ ] Handle child record deletion + insertion

---

### Task 7: Replace Supabase Queries — Admin API Routes

**Files:**
- Modify: `src/app/api/admin/workouts/route.ts`
- Modify: `src/app/api/admin/workouts/[id]/route.ts`
- Modify: `src/app/api/admin/workouts/bulk/route.ts`
- Modify: `src/app/api/admin/regions/route.ts`
- Modify: `src/app/api/admin/regions/[id]/route.ts`

- [ ] Convert all CRUD operations to SQL
- [ ] Replace `validateAdminToken` with Better Auth session check

---

### Task 8: Replace Supabase Queries — Pages & Scripts

**Files:**
- Modify: `src/app/backblasts/[id]/page.tsx`
- Modify: `scripts/backfill-f3-events.ts`

- [ ] Convert page queries to SQL
- [ ] Update backfill script to use Neon directly

---

### Task 9: Update Middleware & Cleanup

**Files:**
- Modify: `src/middleware.ts`
- Delete: `src/lib/supabase.ts`
- Modify: `package.json`
- Modify: `CLAUDE.md`

- [ ] Remove `supabase.co` from CSP connect-src
- [ ] Add Better Auth cookie check for /admin routes
- [ ] `npm uninstall @supabase/supabase-js`
- [ ] Delete `src/lib/supabase.ts`
- [ ] Update CLAUDE.md with new architecture
- [ ] Verify zero Supabase references

---

### Task 10: Build Verification

- [ ] `npm run build` succeeds
- [ ] `npm run dev` loads correctly
- [ ] Admin login works with Better Auth
- [ ] Backblasts page loads data
- [ ] Workout schedule displays correctly
