# AO Channel Auto-Join + Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an admin enables/creates a public AO channel, the bot auto-joins it and backfills its recent history; un-joinable channels (private/archived/removed) surface a warning instead of failing silently.

**Architecture:** A pure trigger helper (`shouldBackfill`) + a Slack-join wrapper (`joinSlackChannel`) + an orchestrator (`resolveBotForChannel`) all live in `src/lib/slack/joinChannel.ts`. The per-channel reconcile body is extracted from `reconcileEnabledChannels` into a dependency-injected `reconcileChannel` (testable) with a real-deps wrapper `reconcileSingleChannel`. The two AO-channel API routes call the orchestrator and return a `botStatus`; the manager UI surfaces it. The Sync result gains `notInChannel[]`.

**Tech Stack:** Next.js 16 route handlers, Neon (`@neondatabase/serverless` tagged-template `sql`), `@slack/web-api` `WebClient`, tests via `node:test` run by `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-05-22-ao-channel-auto-join-design.md`

**Refinement vs spec:** Slack's `conversations.join` does NOT reliably return `already_in_channel` (verified live — Kenmo, already a member, returned `{ok:true}` with no such field). Since the backfill trigger is the enable *transition* (not join novelty), `JoinOutcome` collapses to `{ status: 'in' } | { status: 'cannot_join', reason }`.

---

## File Structure

- **Create** `src/lib/slack/joinChannel.ts` — `JoinOutcome`, `BotStatus`, `shouldBackfill`, `joinSlackChannel`, `resolveBotForChannel`.
- **Create** `tests/joinChannel.test.ts` — unit tests for the above (pure + injected fakes).
- **Modify** `src/lib/slack/reconcileChannels.ts` — extract `reconcileChannel(channel, deps)` (DI) + `reconcileSingleChannel(channel)` (real deps); refactor `reconcileEnabledChannels` to loop over it; add `notInChannel: string[]` to `ReconcileResult`.
- **Create** `tests/reconcileChannel.test.ts` — DI unit tests for `reconcileChannel`.
- **Modify** `src/app/api/admin/ao-channels/route.ts` — POST: after insert, `resolveBotForChannel`; revalidate if backfilled; return `botStatus`.
- **Modify** `src/app/api/admin/ao-channels/[id]/route.ts` — PUT: SELECT prior `is_enabled`; after update, `resolveBotForChannel`; revalidate if backfilled; return `botStatus`.
- **Modify** `src/app/api/admin/ao-channels/sync/route.ts` & `src/app/api/slack/reconcile/route.ts` — pass through `notInChannel`.
- **Modify** `src/app/admin/ao-channels/page.tsx` — surface `botStatus` after save; show `notInChannel` after Sync; update the bot-invite reminder copy.

---

## Task 1: `shouldBackfill` pure trigger helper

**Files:**
- Create: `src/lib/slack/joinChannel.ts`
- Test: `tests/joinChannel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/joinChannel.test.ts
import { test } from 'node:test';
import assert from 'node:assert';
import { shouldBackfill } from '../src/lib/slack/joinChannel';

test('shouldBackfill: true only on enable-transition with bot in channel', () => {
  assert.equal(shouldBackfill(false, true, true), true);   // newly enabled, bot in → backfill
  assert.equal(shouldBackfill(true, true, true), false);   // already enabled (plain edit) → no
  assert.equal(shouldBackfill(false, true, false), false); // enabled but bot can't join → no
  assert.equal(shouldBackfill(false, false, true), false); // staying disabled → no
  assert.equal(shouldBackfill(true, false, true), false);  // disabling → no
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/joinChannel.test.ts`
Expected: FAIL — `shouldBackfill` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/slack/joinChannel.ts

/** Backfill iff the channel is newly enabled (false→true) and the bot can see it. */
export function shouldBackfill(prevEnabled: boolean, nextEnabled: boolean, botInChannel: boolean): boolean {
  return nextEnabled && !prevEnabled && botInChannel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/joinChannel.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slack/joinChannel.ts tests/joinChannel.test.ts
git commit -m "feat(slack): shouldBackfill enable-transition trigger"
```

---

## Task 2: `joinSlackChannel` wrapper

**Files:**
- Modify: `src/lib/slack/joinChannel.ts`
- Test: `tests/joinChannel.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tests/joinChannel.test.ts`)

```ts
import { joinSlackChannel } from '../src/lib/slack/joinChannel';

type JoinFn = (args: { channel: string }) => Promise<unknown>;
const fakeClient = (join: JoinFn) => ({ conversations: { join } });

test('joinSlackChannel → in when join resolves ok', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => ({ ok: true })));
  assert.deepEqual(r, { status: 'in' });
});

test('joinSlackChannel → cannot_join on missing_scope', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'missing_scope' } }; }));
  assert.deepEqual(r, { status: 'cannot_join', reason: 'missing_scope' });
});

test('joinSlackChannel → cannot_join on archived channel', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'is_archived' } }; }));
  assert.deepEqual(r, { status: 'cannot_join', reason: 'is_archived' });
});

test('joinSlackChannel → cannot_join on private channel', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'method_not_supported_for_channel_type' } }; }));
  assert.deepEqual(r, { status: 'cannot_join', reason: 'method_not_supported_for_channel_type' });
});

test('joinSlackChannel rethrows unexpected errors', async () => {
  await assert.rejects(
    () => joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'ratelimited' } }; })),
    (err: unknown) => (err as { data?: { error?: string } })?.data?.error === 'ratelimited'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/joinChannel.test.ts`
Expected: FAIL — `joinSlackChannel` not exported.

- [ ] **Step 3: Write minimal implementation** (add to `src/lib/slack/joinChannel.ts`)

```ts
import { getSlackClient } from './slackClient';

export type JoinOutcome = { status: 'in' } | { status: 'cannot_join'; reason: string };

type JoinCapableClient = { conversations: { join: (args: { channel: string }) => Promise<unknown> } };

// Slack errors that mean "the bot cannot self-join this channel" — surfaced, not thrown.
const CANNOT_JOIN_ERRORS = new Set([
  'is_archived',
  'method_not_supported_for_channel_type', // private channel
  'missing_scope',
  'channel_not_found',
  'is_private',
]);

/** Join a public Slack channel. Returns `in` (joined or already a member) or `cannot_join`. */
export async function joinSlackChannel(
  channelId: string,
  client: JoinCapableClient = getSlackClient()
): Promise<JoinOutcome> {
  try {
    await client.conversations.join({ channel: channelId });
    return { status: 'in' };
  } catch (err) {
    const code = (err as { data?: { error?: string } })?.data?.error;
    if (code && CANNOT_JOIN_ERRORS.has(code)) {
      return { status: 'cannot_join', reason: code };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/joinChannel.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slack/joinChannel.ts tests/joinChannel.test.ts
git commit -m "feat(slack): joinSlackChannel wrapper with cannot_join mapping"
```

---

## Task 3: `resolveBotForChannel` orchestrator + `BotStatus`

**Files:**
- Modify: `src/lib/slack/joinChannel.ts`
- Test: `tests/joinChannel.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tests/joinChannel.test.ts`)

```ts
import { resolveBotForChannel } from '../src/lib/slack/joinChannel';

const base = { slackChannelId: 'C1', displayName: 'Kenmo' };
const joinIn = async () => ({ status: 'in' } as const);
const joinCannot = async () => ({ status: 'cannot_join', reason: 'method_not_supported_for_channel_type' } as const);

test('resolveBotForChannel: disabled → no join, no warning', async () => {
  let joined = false;
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: false, nextEnabled: false },
    { join: async () => { joined = true; return { status: 'in' }; }, reconcile: async () => ({ processed: 9 }) }
  );
  assert.equal(joined, false);
  assert.deepEqual(r, { inChannel: false, backfilled: 0, warning: null });
});

test('resolveBotForChannel: enable-transition + joinable → backfills', async () => {
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: false, nextEnabled: true },
    { join: joinIn, reconcile: async () => ({ processed: 4 }) }
  );
  assert.deepEqual(r, { inChannel: true, backfilled: 4, warning: null });
});

test('resolveBotForChannel: already enabled (edit) → in channel, no backfill', async () => {
  let reconciled = false;
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: true, nextEnabled: true },
    { join: joinIn, reconcile: async () => { reconciled = true; return { processed: 1 }; } }
  );
  assert.equal(reconciled, false);
  assert.deepEqual(r, { inChannel: true, backfilled: 0, warning: null });
});

test('resolveBotForChannel: cannot join → warning, no backfill', async () => {
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: false, nextEnabled: true },
    { join: joinCannot, reconcile: async () => ({ processed: 5 }) }
  );
  assert.equal(r.inChannel, false);
  assert.equal(r.backfilled, 0);
  assert.match(r.warning ?? '', /Kenmo/);
  assert.match(r.warning ?? '', /invite/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/joinChannel.test.ts`
Expected: FAIL — `resolveBotForChannel` not exported.

- [ ] **Step 3: Write minimal implementation** (add to `src/lib/slack/joinChannel.ts`)

```ts
export type BotStatus = { inChannel: boolean; backfilled: number; warning: string | null };

interface ResolveBotDeps {
  join: (channelId: string) => Promise<JoinOutcome>;
  reconcile: (channel: { slack_channel_id: string; ao_display_name: string }) => Promise<{ processed: number }>;
}

/** On create/enable: join the channel and (on enable-transition) backfill its history. Never throws — returns status. */
export async function resolveBotForChannel(
  args: { slackChannelId: string; displayName: string; prevEnabled: boolean; nextEnabled: boolean },
  deps: ResolveBotDeps
): Promise<BotStatus> {
  const { slackChannelId, displayName, prevEnabled, nextEnabled } = args;
  if (!nextEnabled) return { inChannel: false, backfilled: 0, warning: null };

  const outcome = await deps.join(slackChannelId);
  if (outcome.status === 'cannot_join') {
    return {
      inChannel: false,
      backfilled: 0,
      warning: `Couldn't auto-join ${displayName} (${outcome.reason}). Invite @f3_marietta_backblast to the channel in Slack.`,
    };
  }

  if (shouldBackfill(prevEnabled, nextEnabled, true)) {
    const { processed } = await deps.reconcile({ slack_channel_id: slackChannelId, ao_display_name: displayName });
    return { inChannel: true, backfilled: processed, warning: null };
  }
  return { inChannel: true, backfilled: 0, warning: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/joinChannel.test.ts`
Expected: PASS (10 tests total in file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slack/joinChannel.ts tests/joinChannel.test.ts
git commit -m "feat(slack): resolveBotForChannel orchestrator + BotStatus"
```

---

## Task 4: Extract `reconcileChannel` (DI) + refactor `reconcileEnabledChannels`

**Files:**
- Modify: `src/lib/slack/reconcileChannels.ts`
- Test: `tests/reconcileChannel.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/reconcileChannel.test.ts
import { test } from 'node:test';
import assert from 'node:assert';
import { reconcileChannel } from '../src/lib/slack/reconcileChannels';

const channel = { slack_channel_id: 'C1', ao_display_name: 'Kenmo' };
// Fake tagged-template sql that records invocations.
function recordingSql() {
  const calls: unknown[][] = [];
  const sql = ((_s: TemplateStringsArray, ...v: unknown[]) => { calls.push(v); return Promise.resolve([]); }) as unknown as typeof import('../src/lib/db').getSql extends () => infer R ? R : never;
  return { sql, calls };
}
const fakeNormalize = async () => ({
  slack_channel_id: 'C1', slack_message_ts: '1', event_kind: 'backblast',
  content_json: {}, raw_envelope_json: {}, attendees: [], qs: [], blocks: [],
} as Awaited<ReturnType<typeof import('../src/lib/slack/normalizeSlackMessage').normalizeSlackMessage>>);

test('reconcileChannel: not_in_channel → flagged, nothing processed', async () => {
  const { sql } = recordingSql();
  const r = await reconcileChannel(channel, {
    sql,
    fetchHistory: async () => ({ ok: false, error: 'not_in_channel' }),
    normalize: fakeNormalize,
  });
  assert.deepEqual(r, { processed: 0, errors: 1, notInChannel: true });
});

test('reconcileChannel: upserts a backblast, skips chatter/threads/tombstones', async () => {
  const { sql, calls } = recordingSql();
  const r = await reconcileChannel(channel, {
    sql,
    fetchHistory: async () => ({
      ok: true,
      messages: [
        { ts: '100', metadata: { event_type: 'backblast' }, text: 'WARMUP...', bot_id: 'B1' }, // upsert
        { ts: '101', text: 'just chatting' },                                                   // skip (not BB)
        { ts: '102', thread_ts: '100', text: 'backblast reply' },                               // skip (thread reply)
        { ts: '103', subtype: 'tombstone' },                                                    // skip
      ],
    }),
    normalize: fakeNormalize,
  });
  assert.equal(r.processed, 1);
  assert.equal(r.errors, 0);
  assert.equal(r.notInChannel, false);
  assert.equal(calls.length, 1); // exactly one upsert
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/reconcileChannel.test.ts`
Expected: FAIL — `reconcileChannel` not exported.

- [ ] **Step 3: Refactor `reconcileChannels.ts`**

Replace the file body with the extracted, DI version. `ReconcileResult` gains `notInChannel`. Keep the existing message filters and the full INSERT verbatim.

```ts
import { getSql } from '@/lib/db';
import { normalizeSlackMessage, isBackblastPayload, isPreblastPayload } from '@/lib/slack/normalizeSlackMessage';

export interface ReconcileResult {
  processed: number;
  errors: number;
  channels: number;
  notInChannel: string[];
}

interface SlackMessage {
  ts: string; text?: string; user?: string; bot_id?: string; app_id?: string;
  subtype?: string; thread_ts?: string; metadata?: Record<string, unknown>; blocks?: unknown[];
}
export interface SlackConversationsResponse { ok: boolean; messages?: SlackMessage[]; error?: string; }

export type ChannelHistoryFetcher = (channelId: string) => Promise<SlackConversationsResponse>;

interface ReconcileChannelDeps {
  sql: ReturnType<typeof getSql>;
  fetchHistory: ChannelHistoryFetcher;
  normalize: typeof normalizeSlackMessage;
}

/** Pull + upsert one channel's recent history. Pure of globals — all I/O injected, so unit-testable. */
export async function reconcileChannel(
  channel: { slack_channel_id: string; ao_display_name: string },
  deps: ReconcileChannelDeps
): Promise<{ processed: number; errors: number; notInChannel: boolean }> {
  const { sql, fetchHistory, normalize } = deps;
  let processed = 0;
  let errors = 0;

  let data: SlackConversationsResponse;
  try {
    data = await fetchHistory(channel.slack_channel_id);
  } catch (err) {
    console.error(`Error fetching channel ${channel.slack_channel_id}:`, err);
    return { processed: 0, errors: 1, notInChannel: false };
  }

  if (!data.ok) {
    console.error(`Error fetching channel ${channel.slack_channel_id}:`, data.error);
    return { processed: 0, errors: 1, notInChannel: data.error === 'not_in_channel' };
  }

  for (const message of data.messages || []) {
    if (message.subtype === 'tombstone') continue;
    if (message.subtype === 'thread_broadcast') continue;
    if (message.thread_ts && message.thread_ts !== message.ts) continue;

    const rawPayload = JSON.stringify({
      event: {
        type: 'message', channel: channel.slack_channel_id, ts: message.ts,
        text: message.text || '', user: message.user, bot_id: message.bot_id,
        metadata: message.metadata, blocks: message.blocks,
      },
    });

    if (!isBackblastPayload(rawPayload) && !isPreblastPayload(rawPayload)) continue;

    try {
      const normalized = await normalize(rawPayload, channel.ao_display_name);
      await sql`
        INSERT INTO f3_events (slack_channel_id, slack_message_ts, slack_permalink, ao_display_name, event_kind, title, event_date, event_time, location_text, q_slack_user_id, q_name, pax_count, content_text, content_html, content_json, raw_envelope_json, is_deleted)
        VALUES (${normalized.slack_channel_id}, ${normalized.slack_message_ts}, ${normalized.slack_permalink || null}, ${channel.ao_display_name}, ${normalized.event_kind}, ${normalized.title || null}, ${normalized.event_date || null}, ${normalized.event_time || null}, ${normalized.location_text || null}, ${normalized.q_slack_user_id || null}, ${normalized.q_name || null}, ${normalized.pax_count || null}, ${normalized.content_text || null}, ${normalized.content_html || null}, ${JSON.stringify(normalized.content_json)}, ${JSON.stringify(normalized.raw_envelope_json)}, ${false})
        ON CONFLICT (slack_channel_id, slack_message_ts) DO UPDATE SET
          slack_permalink = EXCLUDED.slack_permalink,
          ao_display_name = EXCLUDED.ao_display_name,
          event_kind = EXCLUDED.event_kind,
          title = EXCLUDED.title,
          event_date = EXCLUDED.event_date,
          event_time = EXCLUDED.event_time,
          location_text = EXCLUDED.location_text,
          q_slack_user_id = EXCLUDED.q_slack_user_id,
          q_name = EXCLUDED.q_name,
          pax_count = EXCLUDED.pax_count,
          content_text = EXCLUDED.content_text,
          content_html = EXCLUDED.content_html,
          content_json = EXCLUDED.content_json,
          raw_envelope_json = EXCLUDED.raw_envelope_json,
          is_deleted = EXCLUDED.is_deleted,
          updated_at = now()
      `;
      processed++;
    } catch (err) {
      console.error(`Error processing message ${message.ts}:`, err);
      errors++;
    }
  }

  return { processed, errors, notInChannel: false };
}

/** Build the real Slack history fetcher (last-100 via conversations.history). */
function makeHistoryFetcher(botToken: string): ChannelHistoryFetcher {
  return async (channelId) => {
    const response = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&limit=100`,
      { headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' } }
    );
    return (await response.json()) as SlackConversationsResponse;
  };
}

/** Reconcile a single channel with real deps (used by the create/enable API). */
export async function reconcileSingleChannel(
  channel: { slack_channel_id: string; ao_display_name: string }
): Promise<{ processed: number; errors: number; notInChannel: boolean }> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) throw new Error('SLACK_BOT_TOKEN not configured');
  return reconcileChannel(channel, { sql: getSql(), fetchHistory: makeHistoryFetcher(botToken), normalize: normalizeSlackMessage });
}

/** Pull last-100 history for every enabled ao_channel and idempotently upsert. */
export async function reconcileEnabledChannels(): Promise<ReconcileResult> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) throw new Error('SLACK_BOT_TOKEN not configured');

  const sql = getSql();
  let channels;
  try {
    channels = await sql`SELECT * FROM ao_channels WHERE is_enabled = true`;
  } catch (channelsError) {
    console.error('Error fetching channels:', channelsError);
    throw new Error('Database error');
  }

  if (!channels || channels.length === 0) {
    console.error('No enabled channels found');
    return { processed: 0, errors: 0, channels: 0, notInChannel: [] };
  }

  const fetchHistory = makeHistoryFetcher(botToken);
  let processed = 0;
  let errors = 0;
  const notInChannel: string[] = [];

  for (const channel of channels) {
    const ch = { slack_channel_id: channel.slack_channel_id as string, ao_display_name: channel.ao_display_name as string };
    const r = await reconcileChannel(ch, { sql, fetchHistory, normalize: normalizeSlackMessage });
    processed += r.processed;
    errors += r.errors;
    if (r.notInChannel) notInChannel.push(ch.ao_display_name);
  }

  console.log(`Reconciliation complete: ${processed} processed, ${errors} errors`);
  return { processed, errors, channels: channels.length, notInChannel };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/reconcileChannel.test.ts`
Expected: PASS (2 tests). Then `npm run test:unit` — all unit tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slack/reconcileChannels.ts tests/reconcileChannel.test.ts
git commit -m "refactor(slack): extract reconcileChannel (DI) + notInChannel reporting"
```

---

## Task 5: Wire create (POST) + enable (PUT) routes

**Files:**
- Modify: `src/app/api/admin/ao-channels/route.ts` (POST)
- Modify: `src/app/api/admin/ao-channels/[id]/route.ts` (PUT)

- [ ] **Step 1: Update POST** in `src/app/api/admin/ao-channels/route.ts`

Add imports at top:
```ts
import { revalidatePath } from 'next/cache';
import { joinSlackChannel, resolveBotForChannel } from '@/lib/slack/joinChannel';
import { reconcileSingleChannel } from '@/lib/slack/reconcileChannels';
```

Replace the success `return NextResponse.json(...)` block in `POST` (currently returning `{ channel, warning }`) with:
```ts
    const channel = data[0];
    let botStatus = null;
    if (channel.is_enabled) {
      botStatus = await resolveBotForChannel(
        { slackChannelId: channel.slack_channel_id, displayName: channel.ao_display_name, prevEnabled: false, nextEnabled: true },
        { join: joinSlackChannel, reconcile: reconcileSingleChannel }
      );
      if (botStatus.backfilled > 0) { revalidatePath('/backblasts'); revalidatePath('/'); }
    }
    return NextResponse.json(
      {
        channel,
        warning: nameDup.length ? 'Another channel already uses this display name (analytics groups by it)' : null,
        botStatus,
      },
      { status: 201 }
    );
```

- [ ] **Step 2: Update PUT** in `src/app/api/admin/ao-channels/[id]/route.ts`

Add imports at top (same three as Step 1). Replace the `try` body of `PUT` with:
```ts
    const sql = getSql();
    const prior = await sql`SELECT is_enabled FROM ao_channels WHERE id = ${id}`;
    if (prior.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const prevEnabled = !!prior[0].is_enabled;

    const data = await sql`
      UPDATE ao_channels SET
        ao_display_name = ${body.ao_display_name},
        slack_channel_name = ${body.slack_channel_name ?? null},
        is_enabled = ${body.is_enabled}
      WHERE id = ${id}
      RETURNING *
    `;
    const channel = data[0];

    let botStatus = null;
    if (channel.is_enabled) {
      botStatus = await resolveBotForChannel(
        { slackChannelId: channel.slack_channel_id, displayName: channel.ao_display_name, prevEnabled, nextEnabled: true },
        { join: joinSlackChannel, reconcile: reconcileSingleChannel }
      );
      if (botStatus.backfilled > 0) { revalidatePath('/backblasts'); revalidatePath('/'); }
    }
    return NextResponse.json({ channel, botStatus });
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/ao-channels/route.ts src/app/api/admin/ao-channels/[id]/route.ts
git commit -m "feat(admin): auto-join + backfill on AO channel create/enable"
```

---

## Task 6: Surface `notInChannel` from Sync + reconcile endpoints

**Files:**
- Modify: `src/app/api/admin/ao-channels/sync/route.ts`
- Modify: `src/app/api/slack/reconcile/route.ts`

- [ ] **Step 1: Update sync route** `src/app/api/admin/ao-channels/sync/route.ts`

Change the success return to pass through `notInChannel`:
```ts
    const result = await reconcileEnabledChannels();
    revalidatePath('/');
    revalidatePath('/backblasts');
    return NextResponse.json({ ok: true, ...result }); // result now includes notInChannel[]
```
(If it already spreads `...result`, no change needed beyond confirming `notInChannel` flows. Verify the spread is present.)

- [ ] **Step 2: Update reconcile cron route** `src/app/api/slack/reconcile/route.ts`

In the success `NextResponse.json({ ok: true, processed, errors, channels })`, add `notInChannel`:
```ts
        const { processed, errors, channels, notInChannel } = await reconcileEnabledChannels();
        // ... existing revalidate + bd-knowledge ...
        return NextResponse.json({ ok: true, processed, errors, channels, notInChannel });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/ao-channels/sync/route.ts src/app/api/slack/reconcile/route.ts
git commit -m "feat(admin): Sync reports channels the bot isn't in"
```

---

## Task 7: Surface bot status in the AO Channel Manager UI

**Files:**
- Modify: `src/app/admin/ao-channels/page.tsx`

- [ ] **Step 1: Extend `syncResult` state type** (line ~37)

```ts
  const [syncResult, setSyncResult] = useState<{ processed: number; errors: number; channels: number; notInChannel: string[] } | null>(null);
```

- [ ] **Step 2: Capture `notInChannel` in `handleSync`** (line ~169)

```ts
        setSyncResult({ processed: data.processed, errors: data.errors, channels: data.channels, notInChannel: data.notInChannel ?? [] });
```

- [ ] **Step 3: Surface `botStatus` in `handleSave`** — replace the success block (lines ~108-113)

```ts
      if (res.ok) {
        const data = await res.json();
        const baseMsg = editingChannel ? "Channel updated." : "Channel registered.";
        const parts = [baseMsg];
        if (data.warning) parts.push(`Warning: ${data.warning}`);
        if (data.botStatus?.warning) parts.push(data.botStatus.warning);
        else if (data.botStatus?.backfilled > 0) parts.push(`Bot joined — backfilled ${data.botStatus.backfilled} post(s).`);
        else if (data.botStatus?.inChannel) parts.push("Bot is in the channel.");
        setMessage(parts.join(" "));
        setShowModal(false);
        fetchChannels();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
```

- [ ] **Step 4: Render `notInChannel` after Sync** — replace the `syncResult` span (lines ~202-206)

```tsx
          {syncResult && (
            <span className="font-mono text-xs text-muted">
              // {syncResult.processed} processed · {syncResult.errors} errors · {syncResult.channels} channels
              {syncResult.notInChannel.length > 0 && (
                <span className="text-rust"> · ⚠ bot not in: {syncResult.notInChannel.join(", ")}</span>
              )}
            </span>
          )}
```

- [ ] **Step 5: Update the bot-invite reminder copy** (lines ~398-400)

```tsx
              <p className="text-xs text-muted border-l-2 border-steel/40 pl-3 py-1">
                The bot auto-joins public channels on save and backfills recent posts. Private or
                archived channels still need a manual <span className="font-mono">/invite @f3_marietta_backblast</span>.
              </p>
```

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed.

- [ ] **Step 7: Browser verification (ui-feature-verify gate)**

Run the dev server, open `/admin/ao-channels`, and verify:
- Creating/enabling a public channel the bot can join shows "Bot joined — backfilled N post(s)."
- Editing an already-enabled channel shows "Bot is in the channel." (no re-backfill).
- Sync shows a "⚠ bot not in: …" note when an enabled channel is inaccessible.
Capture a screenshot. If the dev server can't run, say so explicitly — do not claim success.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/ao-channels/page.tsx
git commit -m "feat(admin): surface bot join/backfill status + not-in-channel in manager"
```

---

## Self-Review

**Spec coverage:**
- Auto-join on create/enable → Tasks 2, 3, 5. ✅
- Backfill on enable-transition only → Task 1 (`shouldBackfill`) + Task 3 (orchestrator) + Task 5 (prev `is_enabled` SELECT). ✅
- Join failures never block; warning surfaced → Task 3 (warning), Task 5 (row saved regardless), Task 7 (UI). ✅
- Public-only / private needs manual invite → `cannot_join` mapping (Task 2) + reminder copy (Task 7). ✅
- Sync reports channels bot isn't in → Task 4 (`notInChannel[]`) + Task 6 (passthrough) + Task 7 (render). ✅
- Tests: `shouldBackfill`, `joinSlackChannel`, `resolveBotForChannel`, `reconcileChannel` → Tasks 1-4. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code; the INSERT is reproduced verbatim once (Task 4).

**Type consistency:** `JoinOutcome` (`in`/`cannot_join`), `BotStatus` (`inChannel`/`backfilled`/`warning`), `reconcileChannel` return (`processed`/`errors`/`notInChannel`), `ReconcileResult.notInChannel: string[]`, and the `botStatus`/`notInChannel` JSON keys are used identically across lib, routes, and UI.

**Out of scope (unchanged):** no always-on membership column, no private auto-join, no retry/queue.
