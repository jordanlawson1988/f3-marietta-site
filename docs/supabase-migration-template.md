# Migration Template: Supabase → Neon + Better Auth + Ably

**Based on:** Retro Board migration (March 2026)
**Stack:** Next.js App Router, Neon, Better Auth, Ably, Vercel Blob, Vercel

---

## Pre-migration checklist

### 1. Project audit

Fill this out before writing any code:

```
Project name: _______________
Current Supabase project ref: _______________
Current region: _______________

Supabase features in use:
  [ ] Database (Postgres)
  [ ] Auth (email/password, OAuth, magic link — circle which)
  [ ] Storage (file uploads)
  [ ] Realtime (presence, broadcast, postgres changes — circle which)
  [ ] Edge Functions
  [ ] RLS policies

Database size: ___ MB (check Supabase dashboard > Settings > Billing > Usage)
Number of tables: ___
Number of auth users: ___
Storage size: ___ MB

Current framework: [ ] Next.js App Router  [ ] Next.js Pages Router  [ ] Vite SPA  [ ] Other: ___

If migrating from Vite SPA to Next.js simultaneously:
  [ ] Read Section A (Vite → Next.js structural changes) FIRST
```

### 2. Environment variables

Have these ready before starting. Store in `.env.local` (gitignored by default in Next.js):

```env
# Neon (get from https://console.neon.tech > project > Connect > enable Connection pooling)
DATABASE_URL="postgresql://..."

# Better Auth
BETTER_AUTH_SECRET="[run: openssl rand -base64 32]"
BETTER_AUTH_URL="http://localhost:3000"

# Ably (only if project uses realtime)
ABLY_API_KEY="[root key from https://ably.com/dashboard]"

# Resend (only if project uses email auth / magic links)
RESEND_API_KEY="re_..."

# OAuth providers (reuse from existing Supabase setup, update redirect URIs)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Vercel Blob (only if project uses file storage — no key needed, uses BLOB_READ_WRITE_TOKEN)
BLOB_READ_WRITE_TOKEN="[from Vercel dashboard > project > Storage > Blob]"
```

**IMPORTANT:** Never prefix secrets with `NEXT_PUBLIC_`. Only values safe for the browser get that prefix. Ably clients authenticate via `/api/ably-token`, not a client-side key.

### 3. Neon project setup

1. Go to https://console.neon.tech
2. Create project (name it after your project)
3. Region: match your Vercel deployment region (usually `us-east-1`)
4. Leave "Enable Neon Auth" OFF (you're using Better Auth)
5. Click Connect > enable Connection pooling > copy the pooled connection string

### 4. CLAUDE.md update

Append this to your existing CLAUDE.md (do NOT overwrite):

```markdown
## Architecture (migrated [DATE])

- **Database**: Neon (serverless Postgres, free tier)
- **Auth**: Better Auth (open source, sessions in Neon)
- **Realtime**: Ably (pub/sub + presence, free tier) [REMOVE IF NO REALTIME]
- **File storage**: Vercel Blob [REMOVE IF NO STORAGE]
- **Hosting**: Vercel (Next.js App Router)
- **Previous stack**: Supabase (fully removed)

### Realtime pattern [REMOVE SECTION IF NO REALTIME]

Every mutation follows this pattern:
1. Client adds item to local state immediately (optimistic update)
2. Client calls API route
3. API route writes to Neon
4. API route publishes event to Ably channel
5. All subscribed clients receive the event
6. Ably listener has dedup guard — skips if item already exists by ID

CRITICAL RULES:
- Optimistic update BEFORE fetch, revert on failure
- Client generates all IDs (crypto.randomUUID()) — server uses client's ID
- Every Ably event handler must check: does this item already exist? If yes, skip.
- Ably provider only wraps components that actively use Ably hooks

### Auth pattern

Better Auth handles sessions. API routes verify via:
const session = await auth.api.getSession({ headers: request.headers });

Middleware uses lightweight cookie check (Edge Runtime compatible):
const hasSession = request.cookies.has('better-auth.session_token');
Full session validation in API routes only (Node.js runtime).
```

---

## Phase 1: Database migration (30 min)

### Option A: Using Prisma (recommended if project already uses Prisma)

```bash
# 1. Update DATABASE_URL in .env.local to point to Neon
# 2. Push schema to Neon
npx prisma migrate deploy
# or for initial setup:
npx prisma db push

# 3. Seed data if needed
npx prisma db seed
```

### Option B: Raw SQL migration

```bash
# 1. Export from Supabase (get connection string from Supabase dashboard)
pg_dump "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-privileges \
  > export.sql

# 2. Import to Neon
psql "$DATABASE_URL" < export.sql
```

### Option C: Using Drizzle

```bash
# 1. Update DATABASE_URL in .env.local
# 2. Push schema
npx drizzle-kit push

# 3. If migrating data, use drizzle-kit or raw SQL
```

### Verify

```bash
# Connect to Neon and check tables
psql "$DATABASE_URL" -c "\dt"
# Spot check a table
psql "$DATABASE_URL" -c "SELECT count(*) FROM [your_main_table]"
```

---

## Phase 2: Auth migration (1-2 hours)

### Install

```bash
npm install better-auth
```

### Server config

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { Pool } from "@neondatabase/serverless";

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true, // set false if OAuth-only
    // Uncomment if migrating Supabase users with passwords:
    // hashPassword: async (password) => { /* use bcrypt */ },
    // verifyPassword: async ({ password, hash }) => { /* use bcrypt */ },
  },
  socialProviders: {
    // Add only providers your project uses:
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
});
```

### API route

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

### Client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
```

### Middleware (Edge Runtime compatible)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // LESSON LEARNED: Do NOT call auth.api.getSession() here.
  // Better Auth uses @neondatabase/serverless which needs Node.js runtime.
  // Edge Runtime middleware can't handle it. Use cookie check only.
  const hasSession = request.cookies.has('better-auth.session_token');
  
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Add your protected routes here:
    // '/dashboard/:path*',
    // '/board/:path*',
    // '/admin/:path*',
  ],
};
```

### Migrate existing users

**If project uses OAuth only (Google, GitHub, etc.):**
No migration needed. Users re-authenticate once and Better Auth creates their record. Existing sessions will be invalidated — users log in again.

**If project uses email/password:**
Follow the Supabase migration guide: https://better-auth.com/docs/guides/supabase-migration-guide

Key gotcha: Supabase uses bcrypt, Better Auth defaults to scrypt. Configure Better Auth to use bcrypt for backward compatibility with existing password hashes.

**If project uses magic links:**
Configure Resend for email delivery:
```typescript
// lib/auth.ts — add to betterAuth config
import { resend } from "better-auth/plugins";

export const auth = betterAuth({
  // ... other config
  plugins: [resend()],
  email: {
    sendEmail: async ({ to, subject, html }) => {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@yourdomain.com',
          to, subject, html,
        }),
      });
    },
  },
});
```

### Replace Supabase Auth calls

| Supabase | Better Auth (server) | Better Auth (client) |
|---|---|---|
| `supabase.auth.getUser()` | `auth.api.getSession({ headers })` | `authClient.useSession()` |
| `supabase.auth.signInWithPassword()` | — | `authClient.signIn.email({ email, password })` |
| `supabase.auth.signInWithOAuth()` | — | `authClient.signIn.social({ provider: 'google' })` |
| `supabase.auth.signUp()` | — | `authClient.signUp.email({ email, password, name })` |
| `supabase.auth.signOut()` | — | `authClient.signOut()` |
| `supabase.auth.onAuthStateChange()` | — | `authClient.useSession()` (reactive) |

### Verify

- [ ] Can sign up with new account
- [ ] Can log in
- [ ] Protected routes redirect when logged out
- [ ] Session persists across page refresh

---

## Phase 3: Realtime migration (2-3 hours)

**Skip this phase entirely if the project does not use Supabase Realtime.**

### Install

```bash
npm install ably
```

### Ably token auth route

```typescript
// app/api/ably-token/route.ts
import Ably from 'ably';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const client = new Ably.Rest(process.env.ABLY_API_KEY!);
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: session.user.id,
  });

  return Response.json(tokenRequest);
}
```

### Ably provider

```typescript
// components/providers/AblyProvider.tsx
'use client';
import * as Ably from 'ably';
import { AblyProvider, ChannelProvider } from 'ably/react';
import { useMemo } from 'react';

export function AblyRealtimeProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: React.ReactNode;
}) {
  const client = useMemo(() => new Ably.Realtime({
    authUrl: '/api/ably-token',
    authMethod: 'GET',
    clientId,
  }), [clientId]);

  return (
    <AblyProvider client={client}>
      {children}
    </AblyProvider>
  );
}
```

### LESSON LEARNED: Provider scoping

The Ably provider must ONLY wrap components that use Ably hooks. Components that render before the user is authenticated or before realtime is needed must be OUTSIDE the provider.

```typescript
// WRONG — crashes if PreJoinScreen uses no Ably hooks but is inside provider tree
<AblyProvider>
  {isJoined ? <Board /> : <PreJoinScreen />}
</AblyProvider>

// RIGHT — provider only wraps the component that needs it
{isJoined ? (
  <AblyProvider clientId={userId}>
    <ChannelProvider channelName={`project:${id}`}>
      <Board />
    </ChannelProvider>
  </AblyProvider>
) : (
  <PreJoinScreen />
)}
```

### The mutation pattern (CRITICAL — read carefully)

This is the pattern for EVERY server mutation that should trigger a realtime update. The Retro Board migration's biggest bug source was getting this wrong.

**API route (server):**
```typescript
// app/api/[resource]/route.ts
import { neon } from '@neondatabase/serverless';
import Ably from 'ably';

const sql = neon(process.env.DATABASE_URL!);
const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function POST(request: Request) {
  const body = await request.json();

  // 1. Write to database (use client-provided ID)
  const [item] = await sql`
    INSERT INTO items (id, content, author_id)
    VALUES (${body.id}, ${body.content}, ${body.authorId})
    RETURNING *
  `;

  // 2. Publish to Ably channel
  const channel = ably.channels.get(`project:${body.projectId}`);
  await channel.publish('item-created', { item });

  return Response.json({ item });
}
```

**Client (with optimistic update + dedup):**
```typescript
// LESSON LEARNED: Optimistic update BEFORE fetch, not after.
// The Ably echo will arrive before or after the fetch response — timing is unpredictable.
// If you update state after fetch, you get duplicates.

const createItem = async (content: string) => {
  const id = crypto.randomUUID(); // Client generates ID
  const optimistic = { id, content, authorId: userId };

  // Step 1: Add to local state IMMEDIATELY
  setItems(prev => [...prev, optimistic]);

  // Step 2: Send to server
  const res = await fetch('/api/items', {
    method: 'POST',
    body: JSON.stringify({ id, content, authorId: userId, projectId }),
  });

  // Step 3: Revert on failure
  if (!res.ok) {
    setItems(prev => prev.filter(i => i.id !== id));
  }
  // Do NOT update state again on success — the Ably event handles other clients,
  // and the optimistic update already handled the originating client.
};
```

**Ably listener (with dedup guard):**
```typescript
// LESSON LEARNED: Every Ably event handler MUST check for duplicates.
// The originating client already has the item from the optimistic update.
// Without this guard, every item appears twice for the user who created it.

useChannel({ channelName: `project:${projectId}` }, 'item-created', (message) => {
  setItems(prev => {
    if (prev.some(i => i.id === message.data.item.id)) return prev; // DEDUP
    return [...prev, message.data.item];
  });
});

useChannel({ channelName: `project:${projectId}` }, 'item-updated', (message) => {
  setItems(prev =>
    prev.map(i => i.id === message.data.item.id ? message.data.item : i)
  );
});

useChannel({ channelName: `project:${projectId}` }, 'item-deleted', (message) => {
  setItems(prev => prev.filter(i => i.id !== message.data.itemId));
});
```

### LESSON LEARNED: Client must own ID generation

For dedup to work, the client-generated ID and the database ID must be identical. If the server generates a different ID (e.g., `gen_random_uuid()` in SQL), the dedup guard compares mismatched IDs and fails.

**Rule:** Always send the client-generated `crypto.randomUUID()` to the server. The server inserts it as-is. The Ably event carries the same ID back. The dedup guard matches.

**Exception:** If an entity has no optimistic add (e.g., the UI waits for server confirmation), then server-generated IDs are fine. The Ably listener is the only path that adds the item, so there's nothing to dedup against.

### Presence (if needed)

```typescript
import { usePresence, usePresenceListener } from 'ably/react';

// Enter presence with user data
const { updateStatus } = usePresence(
  { channelName: `project:${projectId}` },
  { name: userName, avatar: avatarUrl }
);

// Subscribe to others
const { presenceData } = usePresenceListener({
  channelName: `project:${projectId}`
});

const onlineUsers = presenceData.map(m => ({
  id: m.clientId,
  name: m.data?.name,
  avatar: m.data?.avatar,
}));
```

### Verify

- [ ] Open two browser tabs on the same page
- [ ] Create an item in tab 1 — appears in tab 2 instantly
- [ ] Create an item in tab 2 — appears in tab 1 instantly
- [ ] NO duplicates in either tab
- [ ] Presence: both tabs see each other as online
- [ ] Close one tab — other tab sees the user leave

---

## Phase 4: Storage migration (30 min - 1 hour)

**Skip this phase if the project does not use Supabase Storage.**

### Option A: Vercel Blob (recommended — already in your Vercel stack)

```bash
npm install @vercel/blob
```

**Upload:**
```typescript
// app/api/upload/route.ts
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File;

  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true, // prevents name collisions
  });

  return Response.json({ url: blob.url });
}
```

**Client upload:**
```typescript
const uploadFile = async (file: File) => {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const { url } = await res.json();
  return url; // store this URL in your database
};
```

### Replace Supabase Storage calls

| Supabase | Vercel Blob |
|---|---|
| `supabase.storage.from('bucket').upload(path, file)` | `put(filename, file, { access: 'public' })` |
| `supabase.storage.from('bucket').getPublicUrl(path)` | URL returned from `put()` — store it in DB |
| `supabase.storage.from('bucket').remove([path])` | `del(url)` from `@vercel/blob` |
| `supabase.storage.from('bucket').list()` | `list()` from `@vercel/blob` |

### Migrate existing files

If the project has existing files in Supabase Storage that need to be preserved:

```typescript
// scripts/migrate-storage.ts
// 1. List all files in Supabase bucket
// 2. Download each file
// 3. Upload to Vercel Blob
// 4. Update database records with new URLs
```

For small projects (< 100 files), this can be a one-time script. For larger projects, consider doing it lazily — serve existing Supabase URLs until they're accessed, then migrate on-demand.

### Gotchas

- **No per-file access control.** Vercel Blob files are public (anyone with URL) or private (server-side token required). No equivalent to Supabase RLS on storage. Handle access control in your API routes.
- **No image transforms.** Supabase can resize on the fly. Vercel Blob serves originals. Use Vercel Image Optimization (`next/image`) for resizing at the CDN level, or generate thumbnails at upload time.
- **5 GB included on Vercel Pro.** Monitor usage in Vercel dashboard.

### Verify

- [ ] Can upload a file
- [ ] File URL is accessible
- [ ] Existing file references still work (or are migrated)
- [ ] Delete works

---

## Phase 5: Replace Supabase client calls

Systematically replace all remaining `supabase.*` calls. Use your IDE's search to find them all:

```bash
# Find all Supabase imports and usages
grep -rn "supabase" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".env"
```

### Database queries

| Supabase | Neon (with @neondatabase/serverless) |
|---|---|
| `supabase.from('table').select()` | `sql\`SELECT * FROM table\`` |
| `supabase.from('table').insert({ ... })` | `sql\`INSERT INTO table (...) VALUES (...) RETURNING *\`` |
| `supabase.from('table').update({ ... }).eq('id', id)` | `sql\`UPDATE table SET ... WHERE id = ${id} RETURNING *\`` |
| `supabase.from('table').delete().eq('id', id)` | `sql\`DELETE FROM table WHERE id = ${id}\`` |

If using Prisma or Drizzle, replace with ORM calls instead of raw SQL.

### RLS replacement

Supabase RLS uses `auth.uid()` automatically. With Better Auth + Neon, you verify the session in each API route and filter queries by userId:

```typescript
// Before: Supabase RLS handled this automatically
const { data } = await supabase.from('boards').select();
// RLS policy: "WHERE user_id = auth.uid()" applied silently

// After: Explicit in API route
const session = await auth.api.getSession({ headers: request.headers });
if (!session) return new Response('Unauthorized', { status: 401 });

const boards = await sql`
  SELECT * FROM boards WHERE user_id = ${session.user.id}
`;
```

---

## Phase 6: Cleanup (30 min)

```bash
# 1. Remove Supabase packages
npm uninstall @supabase/supabase-js @supabase/ssr @supabase/auth-helpers-nextjs

# 2. Delete Supabase-specific files
rm -rf lib/supabase.ts  # or wherever your Supabase client was
rm -rf utils/supabase/   # if you had a utils directory

# 3. Remove Supabase env vars from .env.local
# Delete: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 4. Remove from Vercel environment variables
# Go to Vercel dashboard > project > Settings > Environment Variables
# Delete the same Supabase vars

# 5. Verify no Supabase references remain
grep -rn "supabase" --include="*.ts" --include="*.tsx" | grep -v node_modules

# 6. Build and test
npm run build
npm run dev
```

### Post-cleanup verification

- [ ] `npm run build` succeeds with zero Supabase references
- [ ] App loads and functions correctly
- [ ] Auth works (login, logout, protected routes)
- [ ] Database reads/writes work
- [ ] Realtime works (if applicable) — two tabs, create/update/delete, no duplicates
- [ ] File uploads work (if applicable)
- [ ] Deploy to Vercel preview branch and test there too

### Supabase project disposition

- [ ] Pause the Supabase project (keeps data, costs $0, doesn't count against free limit)
- [ ] OR delete it if you're confident the migration is complete
- [ ] Wait at least 1 week before deleting — gives you a rollback path

---

## Section A: Vite SPA → Next.js structural changes

**Only relevant if migrating from Vite. Skip if already on Next.js.**

### LESSON LEARNED: Do file moves EARLY

The path alias (`@/`) means different things in Vite (`./src/*`) vs Next.js (`./*`). Change the alias before moving files and every import breaks. Move files first.

**Sequence:**
1. Install Next.js dependencies
2. Move files from `src/` to project root IMMEDIATELY
3. Update tsconfig paths: `@/*` → `./*`
4. Continue with remaining migration

### LESSON LEARNED: Rename `pages/` directory

If your Vite project has a `src/pages/` directory, Next.js will interpret it as Pages Router and conflict with App Router. Rename to `views/` or delete before any Next.js code runs.

### LESSON LEARNED: `'use client'` at scale

Everything in Vite is client-side by default. Next.js App Router is server-first. You need `'use client'` on:

- Every component using hooks (`useState`, `useEffect`, `useCallback`, etc.)
- Every file using browser APIs (`localStorage`, `window`, `document`)
- Every Zustand/Jotai store file
- Every custom hook that uses client-side features

You do NOT need it on:
- Type definition files
- Pure utility functions (no browser APIs)
- Barrel export files (re-exports only)

**Find missed directives after migration:**
```bash
npm run build 2>&1 | grep "useState\|useEffect\|useCallback\|useRef\|useContext"
```

### LESSON LEARNED: Theme/SSR hydration mismatch

If using client-side theme switching (dark mode), the server renders one theme but the client may have a different one in localStorage. Fix with a blocking script in `<head>`:

```typescript
// app/layout.tsx
<html lang="en" data-theme="system" suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: `
      (function(){try{var t=localStorage.getItem('theme-key');
      if(t==='light'||t==='dark'||t==='system')
      document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    `}} />
  </head>
```

---

## Quick reference: Project-specific migration scope

Use this to determine which phases apply to each project:

| Project | Phase 1 (DB) | Phase 2 (Auth) | Phase 3 (Realtime) | Phase 4 (Storage) | Section A (Vite→Next) |
|---|---|---|---|---|---|
| F3 Marietta | Yes | Yes | No | Yes | Check framework |
| Harmans Desserts (prod) | Yes | Yes | Yes (polling or Ably) | Yes (already on Vercel Blob) | Check framework |
| Harmans Desserts (staging) | Yes | Yes | Yes | Yes | Check framework |
| CFA Events (DDDN) | Yes | Yes | No | Check | Check framework |
| [New project] | Yes | Yes | If needed | If needed | N/A (start on Next.js) |

---

## Post-migration: Supabase cost reduction

After each project is migrated:

1. Pause the Supabase project (1 week buffer)
2. After confirming everything works, delete the project
3. Once all projects are off the Pro org, downgrade the org to Free
4. Goal: $0/mo Supabase spend

Track progress:

```
[ ] Retro Board — MIGRATED ✓
[ ] CFA Events (DDDN) — 
[ ] F3 Marietta — 
[ ] Harmans Desserts (staging) — 
[ ] Harmans Desserts (prod) — LAST (highest risk, do after pattern is proven)
[ ] Supabase Pro org downgraded — 
```
