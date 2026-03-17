# Newsletter Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the newsletter pipeline with monthly themes, FNG callouts, F2/F3 community event callouts, and a manual generate button — all managed via the dashboard.

**Architecture:** Add 3 new Supabase tables (newsletter_themes, community_events, newsletter_fngs). Extract newsletter generation logic into a shared module. Add CRUD API routes for themes, events, and FNGs. Update the newsletter prompt to produce shorter, structured output. Extend the dashboard with theme management, FNG entry, a generate button, and an events page.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Anthropic SDK (Claude Sonnet 4), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-16-newsletter-enhancement-design.md`

---

## Chunk 1: Database & Types

### Task 1: Migration and TypeScript types

**Files:**
- Create: `supabase/migrations/002_newsletter_enhancements.sql`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create migration file**

```sql
-- 002_newsletter_enhancements.sql

-- Monthly themes for newsletters
CREATE TABLE newsletter_themes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month      INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year       INTEGER NOT NULL CHECK (year >= 2024),
  title      TEXT NOT NULL,
  url        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, year)
);

-- Community events (F2 fellowship + F3 service)
CREATE TABLE community_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL CHECK (event_type IN ('f2', 'f3')),
  title       TEXT NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_events_date_type ON community_events (event_date, event_type);

-- FNG callouts per newsletter
CREATE TABLE newsletter_fngs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  fng_name      TEXT NOT NULL,
  ao_name       TEXT,
  brought_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Add TypeScript interfaces to `src/types/index.ts`**

Append after the existing `CaptionGeneration` interface (line 68):

```typescript
export interface NewsletterTheme {
  id: string;
  month: number;
  year: number;
  title: string;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityEvent {
  id: string;
  event_type: 'f2' | 'f3';
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterFng {
  id: string;
  newsletter_id: string;
  fng_name: string;
  ao_name: string | null;
  brought_by: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Successful build with no type errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_newsletter_enhancements.sql src/types/index.ts
git commit -m "feat: add migration and types for newsletter themes, community events, and FNGs"
```

---

## Chunk 2: API Routes — Themes, Events, FNGs

### Task 2: Theme API

**Files:**
- Create: `src/app/api/themes/route.ts`

- [ ] **Step 1: Create theme route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  const url = new URL(request.url);
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1));
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()));

  const { data, error } = await supabase
    .from('newsletter_themes')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  const body = await request.json();
  const { month, year, title, url: themeUrl } = body;

  if (!month || !year || !title) {
    return NextResponse.json({ error: 'month, year, and title are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('newsletter_themes')
    .upsert(
      {
        month,
        year,
        title,
        url: themeUrl ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'month,year' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/themes/route.ts
git commit -m "feat: add theme API route (GET current, PUT upsert)"
```

### Task 3: Events API

**Files:**
- Create: `src/app/api/events/route.ts`
- Create: `src/app/api/events/[id]/route.ts`

- [ ] **Step 1: Create events list + create route**

```typescript
// src/app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = supabase
    .from('community_events')
    .select('*')
    .order('event_date', { ascending: true });

  if (type) query = query.eq('event_type', type);
  if (from) query = query.gte('event_date', from);
  if (to) query = query.lte('event_date', to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  const body = await request.json();
  const { event_type, title, description, event_date, location } = body;

  if (!event_type || !title || !event_date) {
    return NextResponse.json(
      { error: 'event_type, title, and event_date are required' },
      { status: 400 }
    );
  }

  if (!['f2', 'f3'].includes(event_type)) {
    return NextResponse.json({ error: 'event_type must be f2 or f3' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('community_events')
    .insert({
      event_type,
      title,
      description: description ?? null,
      event_date,
      location: location ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Create event update + delete route**

```typescript
// src/app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.event_type !== undefined) updateFields.event_type = body.event_type;
  if (body.title !== undefined) updateFields.title = body.title;
  if (body.description !== undefined) updateFields.description = body.description;
  if (body.event_date !== undefined) updateFields.event_date = body.event_date;
  if (body.location !== undefined) updateFields.location = body.location;

  const { data, error } = await supabase
    .from('community_events')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;

  const { error } = await supabase
    .from('community_events')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/route.ts src/app/api/events/\[id\]/route.ts
git commit -m "feat: add community events CRUD API routes"
```

### Task 4: FNG API

**Files:**
- Create: `src/app/api/newsletter/[id]/fngs/route.ts`

- [ ] **Step 1: Create FNG route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;

  const { data, error } = await supabase
    .from('newsletter_fngs')
    .select('*')
    .eq('newsletter_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  if (!body.fng_name) {
    return NextResponse.json({ error: 'fng_name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('newsletter_fngs')
    .insert({
      newsletter_id: id,
      fng_name: body.fng_name,
      ao_name: body.ao_name ?? null,
      brought_by: body.brought_by ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;
  const url = new URL(request.url);
  const fngId = url.searchParams.get('fng_id');

  if (!fngId) {
    return NextResponse.json({ error: 'fng_id query param is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('newsletter_fngs')
    .delete()
    .eq('id', fngId)
    .eq('newsletter_id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/newsletter/\[id\]/fngs/route.ts
git commit -m "feat: add newsletter FNG CRUD API route"
```

---

## Chunk 3: Newsletter Generation — Extract, Enhance Prompt, Generate Route

### Task 5: Extract shared generation logic and update prompt

**Files:**
- Create: `src/lib/newsletter-generator.ts`
- Modify: `src/lib/prompts/newsletter.ts` (full rewrite)
- Modify: `src/app/api/cron/generate-newsletter/route.ts`

- [ ] **Step 1: Rewrite the newsletter prompt**

Replace the entire contents of `src/lib/prompts/newsletter.ts`:

```typescript
import type { F3Event, CommunityEvent, NewsletterFng } from '@/types';

export const NEWSLETTER_SYSTEM_PROMPT = `You are writing the weekly recap newsletter for F3 Marietta, a free men's workout group built on brotherhood, accountability, and encouragement. This newsletter gets posted to Slack.

## Tone & Voice
- Brotherhood first — these men chose to get better together this week
- Celebrate consistency and effort, not just big numbers
- Acknowledge the Qs (leaders) who stepped up
- Keep it warm but not soft — men pushing each other
- Use natural F3 language without over-explaining
- Keep it SHORT and actionable. No fluff.

## F3 Lexicon
- PAX = participants, Q = workout leader, AO = Area of Operation
- HC = headcount, FNG = Friendly New Guy, BD = beatdown
- COT = Circle of Trust, EH = Emotional Headlock, Post = show up

## Slack mrkdwn Formatting Rules
- *bold* (single asterisks), _italic_ (underscores)
- Bullet lists with plain dashes
- Use emoji sparingly (:muscle:, :sunrise:, :pray:, :point_right:, :wave:)

## Output Structure (replaces previous structure)
Generate these sections in order:
1. *Week Recap* — ONE concise section covering all AOs together. Mention Qs, notable headcounts. 3-5 sentences max. Do NOT break out by AO.
2. *FNG Spotlight* — If FNG data is provided, celebrate the new men with a dedicated callout. If no FNGs, omit this section entirely.
3. *Upcoming F2 Events* — List fellowship events for the coming week. If none provided, output ":calendar: *Upcoming F2 (Fellowship):* None for the week"
4. *Upcoming F3 Events* — List service/community events for the coming week. If none provided, output ":handshake: *Upcoming F3 (Service):* None for the week"
5. *Closing* — 1-2 sentences. Encourage men to post next week. Punchy.

## Output Requirements
Return ONLY valid JSON with exactly these fields:
{
  "title": "A short, compelling newsletter title for the week",
  "body_markdown": "The full newsletter in standard markdown (## headings, **bold**, - bullets)",
  "body_slack_mrkdwn": "The same newsletter formatted for Slack mrkdwn (*bold*, _italic_, dashes, Slack emoji codes)"
}

Do NOT wrap the JSON in markdown code fences. Return raw JSON only.`;

export interface NewsletterPromptData {
  events: F3Event[];
  weekStart: string;
  weekEnd: string;
  fngs?: NewsletterFng[];
  f2Events?: CommunityEvent[];
  f3Events?: CommunityEvent[];
}

export function buildUserPrompt(data: NewsletterPromptData): string {
  const { events, weekStart, weekEnd, fngs, f2Events, f3Events } = data;

  const parts: string[] = [
    `Write the weekly newsletter for F3 Marietta.`,
    `Week: ${weekStart} through ${weekEnd}`,
    `Total workouts: ${events.length}`,
    ``,
    `Backblasts:`,
  ];

  for (const event of events) {
    const date = event.event_date ?? event.created_at?.split('T')[0] ?? 'unknown date';
    const ao = event.ao_display_name ?? 'Unknown AO';
    const q = event.q_name ?? 'unknown Q';
    const hc = event.pax_count != null ? `${event.pax_count} PAX` : 'HC unknown';
    parts.push(`- ${date} | ${ao} | Q: ${q} | ${hc}`);
    if (event.content_text) {
      const excerpt = event.content_text.length > 300
        ? event.content_text.slice(0, 300) + '...'
        : event.content_text;
      parts.push(`  Summary: ${excerpt}`);
    }
  }

  parts.push(``);

  // FNGs
  parts.push(`FNGs this week:`);
  if (fngs && fngs.length > 0) {
    for (const fng of fngs) {
      const loc = fng.ao_name ? ` at ${fng.ao_name}` : '';
      const by = fng.brought_by ? `, brought by ${fng.brought_by}` : '';
      parts.push(`- ${fng.fng_name}${loc}${by}`);
    }
  } else {
    parts.push(`None this week`);
  }

  parts.push(``);

  // F2 Events
  const nextWeekStart = getNextWeekStart(weekEnd);
  const nextWeekEnd = getNextWeekEnd(weekEnd);
  parts.push(`Upcoming F2 Events (week of ${nextWeekStart}):`);
  if (f2Events && f2Events.length > 0) {
    for (const evt of f2Events) {
      const loc = evt.location ? ` | ${evt.location}` : '';
      parts.push(`- ${evt.event_date} | ${evt.title}${loc}`);
    }
  } else {
    parts.push(`None scheduled`);
  }

  parts.push(``);

  // F3 Events
  parts.push(`Upcoming F3 Events (week of ${nextWeekStart}):`);
  if (f3Events && f3Events.length > 0) {
    for (const evt of f3Events) {
      const loc = evt.location ? ` | ${evt.location}` : '';
      parts.push(`- ${evt.event_date} | ${evt.title}${loc}`);
    }
  } else {
    parts.push(`None scheduled`);
  }

  return parts.join('\n');
}

/** Given the newsletter week_end date string, return the next Monday (start of coming week) */
function getNextWeekStart(weekEnd: string): string {
  const d = new Date(weekEnd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1); // day after week_end = Monday
  return d.toISOString().split('T')[0];
}
```

- [ ] **Step 2: Create the shared newsletter generation module**

Create `src/lib/newsletter-generator.ts`:

```typescript
import { supabase } from '@/lib/supabase';
import { generateNewsletter } from '@/lib/claude';
import {
  NEWSLETTER_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/newsletter';
import type { F3Event, CommunityEvent, NewsletterFng, NewsletterTheme } from '@/types';

export class NewsletterExistsError extends Error {
  constructor(weekStart: string, weekEnd: string) {
    super(`Newsletter already exists for ${weekStart} to ${weekEnd}`);
    this.name = 'NewsletterExistsError';
  }
}

export class NoEventsError extends Error {
  constructor(weekStart: string, weekEnd: string) {
    super(`No events found for ${weekStart} to ${weekEnd}`);
    this.name = 'NoEventsError';
  }
}

export interface GenerateNewsletterResult {
  newsletter_id: string;
  week_start: string;
  week_end: string;
  events_count: number;
  title: string;
}

export function getWeekBoundaries(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const weekStartDate = new Date(now.getTime() - 12 * msPerDay);
  const weekEndDate = new Date(now.getTime() - 6 * msPerDay);
  return {
    weekStart: weekStartDate.toISOString().split('T')[0],
    weekEnd: weekEndDate.toISOString().split('T')[0],
  };
}

function buildThemeBlock(theme: NewsletterTheme | null): { markdown: string; slack: string } {
  if (!theme) return { markdown: '', slack: '' };
  const monthName = new Date(theme.year, theme.month - 1).toLocaleString('en-US', { month: 'long' });
  const urlLine = theme.url ? `\n${theme.url}` : '';
  const urlLineMd = theme.url ? `\n[${theme.url}](${theme.url})` : '';
  return {
    markdown: `## ${monthName} Theme: ${theme.title}${urlLineMd}\n\n---\n\n`,
    slack: `:dart: *${monthName} Theme: ${theme.title}*${urlLine}\n\n---\n\n`,
  };
}

export async function generateNewsletterPipeline(
  weekStart: string,
  weekEnd: string
): Promise<GenerateNewsletterResult> {
  // 1. Check for existing newsletter
  const { data: existing, error: existingError } = await supabase
    .from('newsletters')
    .select('id')
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to check existing: ${existingError.message}`);
  if (existing) throw new NewsletterExistsError(weekStart, weekEnd);

  // 2. Query backblasts
  const { data: events, error: eventsError } = await supabase
    .from('f3_events')
    .select('*')
    .eq('event_kind', 'backblast')
    .eq('is_deleted', false)
    .gte('created_at', `${weekStart}T00:00:00Z`)
    .lte('created_at', `${weekEnd}T23:59:59Z`)
    .order('created_at', { ascending: true });

  if (eventsError) throw new Error(`Failed to query events: ${eventsError.message}`);

  const weekEvents = (events ?? []) as F3Event[];
  if (weekEvents.length === 0) throw new NoEventsError(weekStart, weekEnd);

  // 3. Query theme for the month of weekStart
  const wsDate = new Date(weekStart + 'T00:00:00Z');
  const { data: theme } = await supabase
    .from('newsletter_themes')
    .select('*')
    .eq('month', wsDate.getUTCMonth() + 1)
    .eq('year', wsDate.getUTCFullYear())
    .maybeSingle();

  // 4. Query upcoming F2/F3 events for the week AFTER the newsletter week
  const nextMon = new Date(weekEnd + 'T00:00:00Z');
  nextMon.setUTCDate(nextMon.getUTCDate() + 1);
  const nextSun = new Date(weekEnd + 'T00:00:00Z');
  nextSun.setUTCDate(nextSun.getUTCDate() + 7);
  const nextStart = nextMon.toISOString().split('T')[0];
  const nextEnd = nextSun.toISOString().split('T')[0];

  const { data: f2Events } = await supabase
    .from('community_events')
    .select('*')
    .eq('event_type', 'f2')
    .gte('event_date', nextStart)
    .lte('event_date', nextEnd)
    .order('event_date', { ascending: true });

  const { data: f3Events } = await supabase
    .from('community_events')
    .select('*')
    .eq('event_type', 'f3')
    .gte('event_date', nextStart)
    .lte('event_date', nextEnd)
    .order('event_date', { ascending: true });

  // 5. Log run start
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({ run_type: 'generate_newsletter', status: 'success', started_at: new Date().toISOString() })
    .select('id')
    .single();

  if (runError || !run) throw new Error(`Failed to create agent run: ${runError?.message}`);

  try {
    // 6. Generate with Claude
    const result = await generateNewsletter(
      NEWSLETTER_SYSTEM_PROMPT,
      buildUserPrompt({
        events: weekEvents,
        weekStart,
        weekEnd,
        fngs: [],
        f2Events: (f2Events ?? []) as CommunityEvent[],
        f3Events: (f3Events ?? []) as CommunityEvent[],
      })
    );

    // 7. Prepend theme block
    const themeBlock = buildThemeBlock(theme as NewsletterTheme | null);
    const body_markdown = themeBlock.markdown + result.body_markdown;
    const body_slack_mrkdwn = themeBlock.slack + result.body_slack_mrkdwn;

    // 8. Insert newsletter
    const { data: newsletter, error: insertError } = await supabase
      .from('newsletters')
      .insert({
        week_start: weekStart,
        week_end: weekEnd,
        title: result.title,
        body_markdown,
        body_slack_mrkdwn,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`Failed to insert newsletter: ${insertError.message}`);

    // 9. Log success
    await supabase
      .from('agent_runs')
      .update({
        status: 'success',
        details: { newsletter_id: newsletter?.id, week_start: weekStart, week_end: weekEnd, events_count: weekEvents.length },
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      newsletter_id: newsletter!.id,
      week_start: weekStart,
      week_end: weekEnd,
      events_count: weekEvents.length,
      title: result.title,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabase
      .from('agent_runs')
      .update({ status: 'failure', error_message: errorMessage, completed_at: new Date().toISOString() })
      .eq('id', run.id);
    throw err;
  }
}
```

- [ ] **Step 3: Simplify the cron route to use shared module**

Replace the entire contents of `src/app/api/cron/generate-newsletter/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import {
  generateNewsletterPipeline,
  getWeekBoundaries,
  NewsletterExistsError,
  NoEventsError,
} from '@/lib/newsletter-generator';

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const manualStart = url.searchParams.get('week_start');
  const manualEnd = url.searchParams.get('week_end');

  const { weekStart, weekEnd } = manualStart && manualEnd
    ? { weekStart: manualStart, weekEnd: manualEnd }
    : getWeekBoundaries();

  try {
    const result = await generateNewsletterPipeline(weekStart, weekEnd);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NewsletterExistsError || err instanceof NoEventsError) {
      return NextResponse.json({ message: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create the dashboard generate route**

Create `src/app/api/newsletter/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import {
  generateNewsletterPipeline,
  getWeekBoundaries,
  NewsletterExistsError,
  NoEventsError,
} from '@/lib/newsletter-generator';

export async function POST(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  let weekStart: string;
  let weekEnd: string;

  try {
    const body = await request.json();
    weekStart = body.week_start;
    weekEnd = body.week_end;
  } catch {
    // No body — use default boundaries
    const defaults = getWeekBoundaries();
    weekStart = defaults.weekStart;
    weekEnd = defaults.weekEnd;
  }

  if (!weekStart || !weekEnd) {
    const defaults = getWeekBoundaries();
    weekStart = weekStart || defaults.weekStart;
    weekEnd = weekEnd || defaults.weekEnd;
  }

  try {
    const result = await generateNewsletterPipeline(weekStart, weekEnd);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NewsletterExistsError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof NoEventsError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/lib/newsletter-generator.ts src/lib/prompts/newsletter.ts src/app/api/cron/generate-newsletter/route.ts src/app/api/newsletter/generate/route.ts
git commit -m "feat: extract newsletter generation, update prompt, add generate route"
```

---

## Chunk 4: Dashboard — Newsletter Page Enhancements

### Task 6: Update newsletter page with theme manager, FNG entry, and generate button

**Files:**
- Modify: `src/app/dashboard/newsletter/page.tsx` (significant rewrite)

- [ ] **Step 1: Rewrite the newsletter page**

Replace the entire contents of `src/app/dashboard/newsletter/page.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Newsletter, NewsletterTheme, NewsletterFng } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import NewsletterPreview from '@/components/NewsletterPreview';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString('en-US', { month: 'long' });
}

export default function NewsletterPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  // Theme state
  const [theme, setTheme] = useState<NewsletterTheme | null>(null);
  const [themeTitle, setThemeTitle] = useState('');
  const [themeUrl, setThemeUrl] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);

  // FNG state
  const [fngs, setFngs] = useState<NewsletterFng[]>([]);
  const [newFngName, setNewFngName] = useState('');
  const [newFngAo, setNewFngAo] = useState('');
  const [newFngBy, setNewFngBy] = useState('');
  const [showFngForm, setShowFngForm] = useState(false);

  // Editor state
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  // Generate state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const fetchNewsletters = useCallback(async () => {
    try {
      const res = await fetch('/api/newsletter');
      if (res.ok) {
        const data: Newsletter[] = await res.json();
        setNewsletters(data);
        const draft = data.find((n) => n.status === 'draft');
        if (draft) {
          setEditTitle(draft.title ?? '');
          setEditBody(draft.body_slack_mrkdwn ?? '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch newsletters:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTheme = useCallback(async () => {
    try {
      const res = await fetch(`/api/themes?month=${currentMonth}&year=${currentYear}`);
      if (res.ok) {
        const data = await res.json();
        setTheme(data);
        if (data) {
          setThemeTitle(data.title);
          setThemeUrl(data.url ?? '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch theme:', err);
    }
  }, [currentMonth, currentYear]);

  const fetchFngs = useCallback(async (newsletterId: string) => {
    try {
      const res = await fetch(`/api/newsletter/${newsletterId}/fngs`);
      if (res.ok) {
        setFngs(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch FNGs:', err);
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
    fetchTheme();
  }, [fetchNewsletters, fetchTheme]);

  const currentDraft = newsletters.find((n) => n.status === 'draft') ?? null;
  const pastNewsletters = newsletters.filter((n) => n.status !== 'draft');

  useEffect(() => {
    if (currentDraft) fetchFngs(currentDraft.id);
  }, [currentDraft, fetchFngs]);

  // Theme handlers
  async function handleSaveTheme() {
    setSavingTheme(true);
    try {
      await fetch('/api/themes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentMonth, year: currentYear, title: themeTitle, url: themeUrl || null }),
      });
      await fetchTheme();
    } catch (err) {
      console.error('Failed to save theme:', err);
    } finally {
      setSavingTheme(false);
    }
  }

  // FNG handlers
  async function handleAddFng() {
    if (!currentDraft || !newFngName.trim()) return;
    try {
      const res = await fetch(`/api/newsletter/${currentDraft.id}/fngs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fng_name: newFngName, ao_name: newFngAo || null, brought_by: newFngBy || null }),
      });
      if (res.ok) {
        setNewFngName('');
        setNewFngAo('');
        setNewFngBy('');
        setShowFngForm(false);
        await fetchFngs(currentDraft.id);
      }
    } catch (err) {
      console.error('Failed to add FNG:', err);
    }
  }

  async function handleDeleteFng(fngId: string) {
    if (!currentDraft) return;
    try {
      await fetch(`/api/newsletter/${currentDraft.id}/fngs?fng_id=${fngId}`, { method: 'DELETE' });
      await fetchFngs(currentDraft.id);
    } catch (err) {
      console.error('Failed to delete FNG:', err);
    }
  }

  // Generate handler
  async function handleGenerate() {
    setGenerating(true);
    setGenerateError('');
    try {
      const res = await fetch('/api/newsletter/generate', { method: 'POST' });
      if (res.ok) {
        await fetchNewsletters();
      } else {
        const err = await res.json();
        setGenerateError(err.error ?? 'Generation failed');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  // Save / Post handlers
  async function handleSave() {
    if (!currentDraft) return;
    setSaving(true);
    try {
      await fetch(`/api/newsletter/${currentDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body_slack_mrkdwn: editBody }),
      });
      await fetchNewsletters();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAndPost() {
    if (!currentDraft) return;
    await handleSave();
    setPosting(true);
    try {
      const res = await fetch(`/api/newsletter/${currentDraft.id}/approve`, { method: 'POST' });
      if (res.ok) {
        await fetchNewsletters();
      } else {
        const err = await res.json();
        console.error('Post failed:', err.error);
      }
    } catch (err) {
      console.error('Post failed:', err);
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-foreground/50">Loading newsletters...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Newsletter</h1>

      {/* Theme Manager */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
          {getMonthName(currentMonth)} {currentYear} Theme
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-foreground/50 mb-1">Title</label>
            <input
              type="text"
              value={themeTitle}
              onChange={(e) => setThemeTitle(e.target.value)}
              placeholder="e.g., Acceleration"
              className="w-full px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-foreground/50 mb-1">URL (optional)</label>
            <input
              type="url"
              value={themeUrl}
              onChange={(e) => setThemeUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSaveTheme}
            disabled={savingTheme || !themeTitle.trim()}
            className="px-4 py-1.5 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingTheme ? 'Saving...' : theme ? 'Update Theme' : 'Set Theme'}
          </button>
        </div>
      </div>

      {/* Current draft editor or generate button */}
      {currentDraft ? (
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={currentDraft.status} />
            <span className="text-sm text-foreground/50">
              Week of {formatDate(currentDraft.week_start)} &ndash; {formatDate(currentDraft.week_end)}
            </span>
          </div>

          {/* FNG Entry */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground/70">FNGs This Week</h3>
              {!showFngForm && (
                <button
                  onClick={() => setShowFngForm(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  + Add FNG
                </button>
              )}
            </div>
            {fngs.length > 0 ? (
              <ul className="space-y-1 mb-2">
                {fngs.map((fng) => (
                  <li key={fng.id} className="flex items-center justify-between text-sm text-foreground/80">
                    <span>
                      <strong>{fng.fng_name}</strong>
                      {fng.ao_name && <span className="text-foreground/50"> at {fng.ao_name}</span>}
                      {fng.brought_by && <span className="text-foreground/50"> (EH&apos;d by {fng.brought_by})</span>}
                    </span>
                    <button
                      onClick={() => handleDeleteFng(fng.id)}
                      className="text-xs text-danger hover:text-danger/80 ml-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              !showFngForm && <p className="text-sm text-foreground/40">No FNGs added yet</p>
            )}
            {showFngForm && (
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  value={newFngName}
                  onChange={(e) => setNewFngName(e.target.value)}
                  placeholder="Name *"
                  className="px-2 py-1 bg-muted border border-border rounded text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary w-36"
                />
                <input
                  type="text"
                  value={newFngAo}
                  onChange={(e) => setNewFngAo(e.target.value)}
                  placeholder="AO"
                  className="px-2 py-1 bg-muted border border-border rounded text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary w-32"
                />
                <input
                  type="text"
                  value={newFngBy}
                  onChange={(e) => setNewFngBy(e.target.value)}
                  placeholder="EH'd by"
                  className="px-2 py-1 bg-muted border border-border rounded text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary w-32"
                />
                <button
                  onClick={handleAddFng}
                  disabled={!newFngName.trim()}
                  className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowFngForm(false)}
                  className="px-3 py-1 text-foreground/50 text-xs font-medium rounded hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Editable title */}
          <div>
            <label className="block text-xs font-medium text-foreground/60 mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Newsletter title"
            />
          </div>

          {/* Mrkdwn editor + preview */}
          <NewsletterPreview value={editBody} onChange={setEditBody} />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || posting}
              className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Edits'}
            </button>
            <button
              onClick={handleApproveAndPost}
              disabled={saving || posting || !editBody.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {posting ? 'Posting...' : 'Approve & Post to Slack'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-3">
          <p className="text-foreground/50">No draft newsletter for this week.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Newsletter'}
          </button>
          {generateError && <p className="text-sm text-danger">{generateError}</p>}
        </div>
      )}

      {/* Past newsletters */}
      {pastNewsletters.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Past Newsletters</h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/60">
                    <th className="px-4 py-3 font-medium">Week</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {pastNewsletters.map((nl, idx) => (
                    <tr key={nl.id} className={`border-b border-border last:border-b-0 ${idx % 2 === 1 ? 'bg-muted/40' : ''}`}>
                      <td className="px-4 py-3 text-foreground/70 whitespace-nowrap">
                        {formatDate(nl.week_start)} &ndash; {formatDate(nl.week_end)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{nl.title ?? 'Untitled'}</td>
                      <td className="px-4 py-3"><StatusBadge status={nl.status} /></td>
                      <td className="px-4 py-3 text-foreground/50 whitespace-nowrap">{formatTimestamp(nl.posted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pastNewsletters.length === 0 && !currentDraft && (
        <p className="text-foreground/50 text-center py-8">No newsletters yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/newsletter/page.tsx
git commit -m "feat: add theme manager, FNG entry, and generate button to newsletter page"
```

---

## Chunk 5: Dashboard — Events Page & Nav Update

### Task 7: Events page and nav link

**Files:**
- Create: `src/app/dashboard/events/page.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Add Events nav link**

In `src/app/dashboard/layout.tsx`, add to the `NAV_LINKS` array (line 8-11):

```typescript
const NAV_LINKS = [
  { href: '/dashboard', label: 'Pending Drafts' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/dashboard/newsletter', label: 'Newsletter' },
  { href: '/dashboard/events', label: 'Events' },
];
```

- [ ] **Step 2: Create events page**

Create `src/app/dashboard/events/page.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CommunityEvent } from '@/types';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const TYPE_STYLES = {
  f2: { label: 'F2', bg: 'bg-blue-500/20 text-blue-400' },
  f3: { label: 'F3', bg: 'bg-green-500/20 text-green-400' },
};

export default function EventsPage() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'f2' | 'f3'>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'f2' | 'f3'>('f2');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const today = new Date().toISOString().split('T')[0];
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);
  const filtered = (filter === 'all' ? upcoming : upcoming.filter((e) => e.event_type === filter));

  function resetForm() {
    setFormType('f2');
    setFormTitle('');
    setFormDate('');
    setFormLocation('');
    setFormDescription('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(evt: CommunityEvent) {
    setFormType(evt.event_type);
    setFormTitle(evt.title);
    setFormDate(evt.event_date);
    setFormLocation(evt.location ?? '');
    setFormDescription(evt.description ?? '');
    setEditingId(evt.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/events/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: formType, title: formTitle, event_date: formDate, location: formLocation || null, description: formDescription || null }),
        });
      } else {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: formType, title: formTitle, event_date: formDate, location: formLocation || null, description: formDescription || null }),
        });
      }
      resetForm();
      await fetchEvents();
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
      await fetchEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-foreground/50">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Community Events</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            + Add Event
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground/70">
            {editingId ? 'Edit Event' : 'New Event'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as 'f2' | 'f3')}
              className="px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="f2">F2 (Fellowship)</option>
              <option value="f3">F3 (Service)</option>
            </select>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Event title *"
              className="flex-1 min-w-[200px] px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="Location (optional)"
              className="flex-1 min-w-[200px] px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 min-w-[200px] px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !formTitle.trim() || !formDate}
              className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-1.5 text-foreground/50 text-sm font-medium rounded-md hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'f2', 'f3'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              filter === f ? 'bg-primary text-white' : 'text-foreground/60 hover:text-foreground hover:bg-muted'
            }`}
          >
            {f === 'all' ? 'All' : f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Upcoming events */}
      {filtered.length > 0 ? (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {filtered.map((evt) => (
            <div key={evt.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${TYPE_STYLES[evt.event_type].bg}`}>
                  {TYPE_STYLES[evt.event_type].label}
                </span>
                <div>
                  <span className="text-sm font-medium text-foreground">{evt.title}</span>
                  <span className="text-sm text-foreground/50 ml-2">{formatDate(evt.event_date)}</span>
                  {evt.location && <span className="text-sm text-foreground/40 ml-2">{evt.location}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(evt)} className="text-xs text-foreground/50 hover:text-foreground">Edit</button>
                <button onClick={() => handleDelete(evt.id)} className="text-xs text-danger hover:text-danger/80">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-foreground/50">No upcoming events.</p>
        </div>
      )}

      {/* Past events */}
      {past.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-foreground/50 cursor-pointer hover:text-foreground">
            Past Events ({past.length})
          </summary>
          <div className="mt-2 bg-card border border-border rounded-lg divide-y divide-border opacity-60">
            {past.map((evt) => (
              <div key={evt.id} className="px-4 py-2 flex items-center gap-3">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${TYPE_STYLES[evt.event_type].bg}`}>
                  {TYPE_STYLES[evt.event_type].label}
                </span>
                <span className="text-sm text-foreground">{evt.title}</span>
                <span className="text-sm text-foreground/50">{formatDate(evt.event_date)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/events/page.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add events page and nav link to dashboard"
```

---

## Chunk 6: Deploy & Verify

### Task 8: Run migration, deploy, and verify

- [ ] **Step 1: Run migration in Supabase SQL Editor**

Copy the contents of `supabase/migrations/002_newsletter_enhancements.sql` and run it in the Supabase SQL Editor.

- [ ] **Step 2: Deploy to Vercel**

```bash
git push origin main
vercel --prod
```

- [ ] **Step 3: Verify theme manager works**

1. Open https://f3-automation.vercel.app/dashboard/newsletter
2. Set a theme title and optional URL
3. Verify it saves and displays

- [ ] **Step 4: Verify events CRUD works**

1. Navigate to Events tab
2. Add an F2 event and an F3 event
3. Edit one, delete one
4. Verify filter buttons work

- [ ] **Step 5: Verify newsletter generation with new data**

1. Add a theme, an F2 event, and an F3 event for the coming week
2. Delete the existing draft newsletter if present (or use a different week)
3. Click "Generate Newsletter"
4. Verify the output includes the theme block, concise recap, F2/F3 sections

- [ ] **Step 6: Verify FNG entry**

1. With a draft newsletter, add an FNG
2. Verify it appears in the list
3. Remove it and verify it's gone
