# Multi-Admin System — Design

**Date:** 2026-05-20
**Status:** Approved (brainstorming complete, pending implementation plan)
**Author:** Jordan Lawson + Claude

## Problem

F3 Marietta's admin console currently depends on a single account whose credentials Jordan manages personally. Any authenticated Better Auth session gets full `/admin` access — there are no roles, no self-service onboarding, and no profiles. This is fragile (bus factor of one) and doesn't scale to a volunteer ops team.

## Goal

Let trusted F3 Marietta people self-register, build a lightweight profile, and have any existing admin grant or revoke their admin access — removing the single-admin dependency. Lay the groundwork so a future "Sign in with F3 Nation" integration drops in cleanly.

## Decisions (locked during brainstorming)

1. **Scope:** Admin/ops team only. No public member area. "Non-admin" means a pending or revoked account with zero admin capability.
2. **Onboarding:** Self-signup (email/password) → lands in `pending` → an existing admin grants access.
3. **Roles:** Flat — every admin is equal; any admin can approve pending users and promote/demote others. Safety net: the system refuses to remove the **last remaining admin** (prevents total lockout).
4. **F3 Nation:** Phased. Ship email/password + a manual `f3nation_url` field now. "Sign in with F3 Nation" (OIDC via Better Auth against `auth.f3nation.com`) is a fast-follow with its own spec, blocked only on F3 Nation registering us as an OAuth client. See [F3 Nation integration](#f3-nation-integration-future).
5. **Profile fields (lean):** `f3_name`, `real_name`, `f3nation_url`. Email comes from the login account.
6. **Data model:** A dedicated `member_profiles` table (1:1 with Better Auth `user`). Better Auth keeps owning identity tables untouched.

## Architecture

### Data model

New migration creates `member_profiles`:

```
member_profiles (
  user_id      text PRIMARY KEY  REFERENCES "user"(id) ON DELETE CASCADE
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','admin','revoked'))
  f3_name      text
  real_name    text
  f3nation_url text
  approved_by  text          -- user_id of the admin who approved/changed status
  approved_at  timestamptz
  created_at   timestamptz NOT NULL DEFAULT now()
  updated_at   timestamptz NOT NULL DEFAULT now()
)
```

Notes:
- `"user"` is the Better Auth user table; exact table/column casing verified during implementation.
- The `status` vocabulary is declared **once** in `src/lib/constants/memberStatus.ts` (`as const` array + derived TS union type) and imported by API routes, UI, and validation. The DB CHECK mirrors it. A contract unit test asserts the constant and the type stay in sync (per the single-source-of-truth rule).

### Status semantics

| status    | meaning                                  | admin console access |
|-----------|------------------------------------------|----------------------|
| `pending` | signed up, awaiting approval             | none (sees "awaiting approval") |
| `admin`   | approved, full admin                     | full |
| `revoked` | access removed by an admin               | none (sees "access revoked") |

### Signup → approval flow

1. Better Auth email/password **sign-up** is enabled (only sign-in is exposed today). New public page `/admin/signup`.
2. Better Auth `databaseHooks.user.create.after` auto-inserts a `member_profiles` row at `status='pending'`.
3. A pending (or revoked) user has a valid session but no admin capability — the console shows a status screen instead of admin pages.
4. An existing admin approves them in `/admin/team`; status flips to `admin` and they gain access on next request.

### Access enforcement (security-critical)

- New server helper `getActiveAdmin(request)`:
  - No Better Auth session → `{ state: 'unauthenticated' }`
  - Session but `member_profiles.status !== 'admin'` → `{ state: 'pending' | 'revoked', user }`
  - Session and `status === 'admin'` → `{ state: 'admin', user, profile }`
- The admin layout gates **server-side**: unauthenticated → login UI; authenticated non-admin → status screen; admin → render console. The existing client-side `AdminAuthProvider` login form is reused for the unauthenticated case.
- **Every route under `/api/admin/*` migrates** from the current "valid session exists" check (`validateAdminToken` / `getAdminSession`) to `getActiveAdmin`, requiring `status='admin'`. Without this, a pending user could call admin APIs directly. This covers existing routes (workouts, regions, drafts, kb, newsletter incl. the routes shipped 2026-05-19, aliases, analytics export) plus the new team/profile routes. Implementation begins by enumerating all `/api/admin/*` routes.
- Edge middleware keeps the fast cookie presence check as a first pass; `getActiveAdmin` is the authoritative server-side gate.

### Admin management UI — `/admin/team`

- Lists members joined `member_profiles` × `user` (email, f3_name, status, created_at), grouped: **Pending**, **Admins**, **Revoked**.
- Actions: Approve (pending → admin), Revoke (admin → revoked), Re-instate (revoked → admin).
- Actions hit `PATCH /api/admin/team/[userId]` with `{ status }`, validated against the status vocabulary.
- **Last-admin guard:** any transition that would leave zero `admin` rows is rejected (server-side, with a clear error). Applies to revoking others and self-revocation.
- `approved_by` / `approved_at` recorded on each status change for attribution.

### Profile UI — `/admin/profile`

- Self-service form: `f3_name`, `real_name`, `f3nation_url`. Email shown read-only from the account.
- `f3nation_url` gets light validation (looks like a `me.f3nation.com` URL); empty allowed.
- Saves via `PATCH /api/admin/profile` (a member edits only their own profile).

### Bootstrap / migration

- The migration seeds existing Better Auth user account(s) — i.e. Jordan's — into `member_profiles` at `status='admin'`, so console access is not lost on deploy.

## F3 Nation integration (future)

Not built in this spec. Captured so the data model stays compatible:

- `auth.f3nation.com` is an OAuth 2.0 / OIDC server (NextAuth v5, Authorization Code + PKCE; default scopes `openid profile email`). Existing clients include `apps/me` (= me.f3nation.com), `pax-vault`, `the-codex`.
- Better Auth supports generic OIDC providers, so "Sign in with F3 Nation" is straightforward on our side.
- **Blocker:** client registration is performed by the F3 Nation team via their `apps/auth` CLI / a SQL insert into `auth.oauth_clients`. We cannot self-register; Jordan must request a `client_id`/secret + redirect-URI whitelist from the F3 Nation tech team.
- Because `member_profiles` keys off `user_id`, no schema change is needed when SSO lands: F3 Nation logins hit the same create-hook (→ pending) and their `profile`/`email` claims can prefill `f3_name` / `real_name` / `f3nation_url`.

## Testing

- **Unit:** status-vocabulary contract test (constant ↔ type ↔ allowed set); `getActiveAdmin` decision matrix (unauthenticated / pending / revoked / admin); last-admin guard logic.
- **E2E (Playwright):** signup → pending screen → admin approves → access granted → revoke → access lost; last-admin guard blocks removing the final admin.

## Out of scope (YAGNI)

- The F3 Nation OAuth/OIDC integration itself (fast-follow, separate spec once client registration is obtained).
- Member-facing area / public profiles.
- Multiple role tiers or per-section granular permissions (flat model only).
- Avatar upload, home AO, phone number.
- Email notifications on approval/revocation.
