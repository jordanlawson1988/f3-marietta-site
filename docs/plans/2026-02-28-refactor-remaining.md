# Refactor Plan — Remaining Items

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the 4 remaining items from the F3 Marietta architecture refactor plan.

**Architecture:** Server-rendered Next.js 16 App Router with Supabase PostgreSQL. All DB queries are server-side. YouTube embeds and FAQ filtering are client-side interactive components.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, Supabase, Playwright

---

## Task 1: Read-Only Supabase Client + RLS Policies

**Why:** The app uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) for every query, including public reads. If any injection path exists, it has full DB access. Public read queries should use the anon key with RLS policies.

**Files:**
- Modify: `src/lib/supabase.ts`
- Modify: `.env.local` (add anon key)
- Create: `supabase/migrations/20260228_rls_policies.sql`
- Modify: `src/lib/workouts/getWorkoutSchedule.ts`
- Modify: `src/lib/backblast/getBackblastsPaginated.ts`
- Modify: `src/app/backblasts/[id]/page.tsx`

### Step 1: Add the anon key to environment

Add `SUPABASE_ANON_KEY` to `.env.local`. Get this from the Supabase dashboard → Settings → API → `anon` `public` key. Also add to `.env.example` if it exists, and to Vercel environment variables.

### Step 2: Create the read-only Supabase client

In `src/lib/supabase.ts`, add a second client export `supabasePublic` using the anon key. Keep the existing `supabase` (service role) client unchanged for write operations.

```typescript
// --- Read-only client (anon key, respects RLS) ---
function getSupabasePublic(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const supabasePublic = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabasePublic();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
```

### Step 3: Write the RLS migration

Create `supabase/migrations/20260228_rls_policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE f3_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE f3_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE f3_event_qs ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ao_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_schedule ENABLE ROW LEVEL SECURITY;

-- Public read access for anon role
CREATE POLICY "Allow public read on f3_events"
  ON f3_events FOR SELECT TO anon
  USING (is_deleted = false);

CREATE POLICY "Allow public read on workout_schedule"
  ON workout_schedule FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow public read on ao_channels"
  ON ao_channels FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow public read on slack_users"
  ON slack_users FOR SELECT TO anon
  USING (true);

-- Service role bypasses RLS, so no policies needed for writes.
-- Child tables (attendees, qs) are only accessed server-side via service role.
```

### Step 4: Migrate read-only consumers

Replace `supabase` with `supabasePublic` in these files (read-only queries only):

**`src/lib/workouts/getWorkoutSchedule.ts`:**
```typescript
import { supabasePublic } from '@/lib/supabase';
// Change: supabase.from('workout_schedule') → supabasePublic.from('workout_schedule')
```

**`src/lib/backblast/getBackblastsPaginated.ts`:**
```typescript
import { supabasePublic } from '@/lib/supabase';
// Change all supabase.from('f3_events') → supabasePublic.from('f3_events')
```

**`src/app/backblasts/[id]/page.tsx`:**
```typescript
import { supabasePublic } from '@/lib/supabase';
// Change the getF3Event() query to use supabasePublic
```

**Do NOT change** these files (they need write access via service role):
- `src/app/api/slack/events/route.ts`
- `src/app/api/slack/reconcile/route.ts`
- `src/app/api/slack/sync-users/route.ts`
- `src/lib/slack/lookupSlackUser.ts`
- All `scripts/*.ts` files

### Step 5: Run the RLS migration

Run the SQL from Step 3 in the Supabase SQL Editor (dashboard → SQL Editor → paste → run).

### Step 6: Verify the app still works

```bash
npm run dev
```

- Visit `/workouts` — schedule should load
- Visit `/backblasts` — list should load, search should work
- Visit a backblast detail page — content should render
- Check browser console and server logs for Supabase errors

### Step 7: Run existing tests

```bash
npm run test:e2e
```

All tests should pass. If any fail due to missing `SUPABASE_ANON_KEY` in CI, add it to `.github/workflows/ci.yml` env vars.

### Step 8: Commit

```bash
git add src/lib/supabase.ts src/lib/workouts/getWorkoutSchedule.ts \
  src/lib/backblast/getBackblastsPaginated.ts src/app/backblasts/\[id\]/page.tsx \
  supabase/migrations/20260228_rls_policies.sql
git commit -m "security: add read-only Supabase client with RLS policies"
```

---

## Task 2: OG Meta Images + Social Sharing Cards

**Why:** The site has only basic title/description metadata. No Open Graph images or Twitter cards — missed opportunity for a community-recruiting website that gets shared on social media.

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/backblasts/[id]/page.tsx`
- Use existing: `public/images/MariettaHomePage.jpeg` (232 KB — good OG image size)

### Step 1: Add metadataBase and OG config to root layout

In `src/app/layout.tsx`, expand the `metadata` export:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://f3marietta.com'),
  title: {
    default: 'F3 Marietta | Fitness, Fellowship, Faith',
    template: '%s | F3 Marietta',
  },
  description:
    'F3 Marietta is a region of F3 Nation in Marietta, GA. Free, peer-led workouts for men.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'F3 Marietta',
    title: 'F3 Marietta | Fitness, Fellowship, Faith',
    description:
      'Free, peer-led outdoor workouts for men in Marietta, GA. No sign-up required — just show up.',
    images: [
      {
        url: '/images/MariettaHomePage.jpeg',
        width: 1200,
        height: 630,
        alt: 'F3 Marietta — Fitness, Fellowship, Faith',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'F3 Marietta | Fitness, Fellowship, Faith',
    description:
      'Free, peer-led outdoor workouts for men in Marietta, GA. No sign-up required — just show up.',
    images: ['/images/MariettaHomePage.jpeg'],
  },
};
```

**Note:** If the production URL is different from `https://f3marietta.com`, update `metadataBase` accordingly. The `title.template` means child pages can just set `title: 'Backblasts'` and get `Backblasts | F3 Marietta` automatically.

### Step 2: Update backblast detail page metadata

In `src/app/backblasts/[id]/page.tsx`, update `generateMetadata` to include OG fields:

```typescript
export async function generateMetadata({ params }: BackblastDetailPageProps) {
  const { id } = await params;
  const event = await getF3Event(id);

  if (!event) {
    return { title: 'Event Not Found' };
  }

  const eventType = event.event_kind === 'preblast' ? 'Preblast' : 'Backblast';
  const title = event.ao_display_name
    ? `${event.ao_display_name} ${eventType}`
    : eventType;
  const description = event.content_text?.slice(0, 160) ?? '';

  return {
    title,
    description,
    openGraph: {
      title: `${title} | F3 Marietta`,
      description,
      type: 'article',
      images: ['/images/MariettaHomePage.jpeg'],
    },
  };
}
```

**Note:** The `title` here uses just the page-specific part (e.g. `"The Mothership Backblast"`) and the root layout `title.template` appends `| F3 Marietta`. The `openGraph.title` uses the full string since OG doesn't inherit templates.

### Step 3: Verify with dev tools

```bash
npm run dev
```

- Visit `http://localhost:3000` → View Page Source → confirm `<meta property="og:image"...>` and `<meta name="twitter:card"...>` are present
- Visit a backblast detail page → confirm OG meta tags include the backblast title

### Step 4: Commit

```bash
git add src/app/layout.tsx src/app/backblasts/\[id\]/page.tsx
git commit -m "feat: add Open Graph and Twitter card metadata for social sharing"
```

---

## Task 3: Lazy-Load YouTube Iframes

**Why:** The New Here page loads 4 YouTube iframes immediately, adding significant third-party JavaScript on mobile. Click-to-play thumbnails defer iframe loading until the user explicitly wants to watch.

**Files:**
- Create: `src/components/ui/YouTubeEmbed.tsx`
- Modify: `src/app/new-here/page.tsx`

### Step 1: Create the YouTubeEmbed component

Create `src/components/ui/YouTubeEmbed.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
}

export default function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative w-full pt-[56.25%]">
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="relative w-full pt-[56.25%] cursor-pointer group bg-black"
      aria-label={`Play video: ${title}`}
    >
      <Image
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt={title}
        fill
        className="object-cover absolute top-0 left-0"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:bg-red-700 transition-colors shadow-lg">
          <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}
```

### Step 2: Update the New Here page to use it

In `src/app/new-here/page.tsx`, replace the `VideoCard` component's iframe with `YouTubeEmbed`:

```tsx
import YouTubeEmbed from '@/components/ui/YouTubeEmbed';

function VideoCard({ title, videoId }: { title: string; videoId: string }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-bold font-heading text-foreground">{title}</h3>
      </div>
      <YouTubeEmbed videoId={videoId} title={title} />
    </div>
  );
}
```

Remove the old inline iframe code from `VideoCard`.

### Step 3: Verify visually

```bash
npm run dev
```

- Visit `/new-here` — should see 4 video thumbnails with play buttons, NOT iframes
- Click a play button — iframe should load with `autoplay=1`
- Check Network tab — no YouTube requests until a play button is clicked

### Step 4: Commit

```bash
git add src/components/ui/YouTubeEmbed.tsx src/app/new-here/page.tsx
git commit -m "perf: lazy-load YouTube iframes with click-to-play thumbnails"
```

---

## Task 4: FAQ Search/Filter on New Here Page

**Why:** With 48 FAQ files (filtered to FNG-tagged), users must click through each accordion item individually. A search input lets them quickly find answers.

**Files:**
- Create: `src/app/new-here/FAQSection.tsx` (client component for interactive filtering)
- Modify: `src/app/new-here/page.tsx` (extract FAQ section into new component)

### Step 1: Create the FAQSection client component

Create `src/app/new-here/FAQSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import FAQItem from '@/components/ui/FAQItem';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQ[];
}

export default function FAQSection({ faqs }: FAQSectionProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(search.toLowerCase()) ||
          faq.answer.toLowerCase().includes(search.toLowerCase())
      )
    : faqs;

  return (
    <div>
      <div className="mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search FAQs..."
          className="w-full max-w-md px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Search frequently asked questions"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No FAQs match your search.</p>
      ) : (
        <div>
          {filtered.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Update the New Here page

In `src/app/new-here/page.tsx`, replace the inline FAQ rendering with the new component:

```tsx
import FAQSection from './FAQSection';

// In the JSX, replace the FAQ items loop:
// Before:
//   {faqs.map((faq) => (
//     <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
//   ))}
//
// After:
<FAQSection faqs={faqs} />
```

The `getFAQs()` function stays in the server component. Only the rendered list moves to the client component via props.

### Step 3: Verify

```bash
npm run dev
```

- Visit `/new-here` → scroll to FAQ section
- Should see a search input above the FAQ items
- Type a search term (e.g., "sign up") → list should filter in real-time
- Clear search → all FAQs should reappear
- Empty search results → should show "No FAQs match your search."

### Step 4: Run tests

```bash
npm run test:e2e
```

### Step 5: Commit

```bash
git add src/app/new-here/FAQSection.tsx src/app/new-here/page.tsx
git commit -m "feat: add search filter to FAQ section on New Here page"
```

---

## Final Verification

After all 4 tasks are complete:

```bash
npm run build && npm run lint && npm run test:e2e
```

All should pass. The refactor plan is then fully complete.
