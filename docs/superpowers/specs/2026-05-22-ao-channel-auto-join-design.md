# AO Channel Auto-Join + Backfill — Design

**Date:** 2026-05-22
**Status:** Approved (brainstorming complete, pending implementation plan)
**Author:** Jordan Lawson + Claude

## Problem

Enabling an AO in the AO Channel Manager only inserts an `ao_channels` row — it never adds
the bot (`@f3_marietta_backblast`) to the Slack channel. Slack delivers `message` events and
`conversations.history` **only for channels the bot has joined**, so a freshly-enabled AO
silently ingests nothing until someone manually invites the bot. The failure is invisible:
the webhook (`/api/slack/events`) drops events for channels that aren't enabled, and the
reconcile/sync swallows `not_in_channel` as a generic error.

This caused the **2026-05-22 incident**: Kenmo's 5/20 backblast was missing (channel enabled
5/21, bot never invited), and The Last Stand had been silently stale since 5/4 after the bot
was removed. Resolution required manually inviting the bot, then running the backfill.

## Goal

When an admin enables (or creates) a **public** AO channel, the bot joins it automatically and
backfills its recent history so existing posts appear immediately. When auto-join can't work
(private/archived channel, or the bot is later removed), surface it clearly instead of failing
silently. The `channels:join` bot scope was added 2026-05-22 to enable this.

## Decisions (locked during brainstorming)

1. **Enable behavior:** on **create-enabled** or an **enable transition** (`is_enabled` goes
   false→true), call `conversations.join`; if the bot is in the channel (`joined` *or*
   `already_in`), backfill that channel's recent history, then revalidate `/backblasts` + `/`.
   The trigger is the *enable transition*, not the join outcome — a channel can be disabled
   (webhook drops its events) while the bot is still a Slack member, so re-enabling must
   backfill even when `already_in`. Editing an *already-enabled* channel (no transition) does
   **not** re-backfill. `cannot_join` ⇒ skip backfill + warning.
2. **Join failures never block config:** the `ao_channels` row always saves; join/backfill
   problems return an informational warning, not an error.
3. **Surfacing:** inline status after create/edit (`✅ joined & backfilled N` /
   `⚠️ couldn't join — invite manually`); the existing **Sync** button additionally reports any
   enabled channels the bot isn't in (catches later removals like The Last Stand).
4. **Public channels only:** private channels can't be self-joined via API (Slack limitation) —
   they always require a manual invite; the warning tells the admin so.
5. **Best-effort scope:** no retry/queue, no always-on membership column, no per-row live
   `conversations.info` checks.

## Architecture

### New: `joinSlackChannel(channelId)` — `src/lib/slack/joinChannel.ts`

Wraps `getSlackClient().conversations.join({ channel })`. Returns a typed result:

```ts
type JoinOutcome =
  | { status: 'joined' }
  | { status: 'already_in' }
  | { status: 'cannot_join'; reason: string };
```

- `ok` + `already_in_channel: true` → `already_in`; `ok` otherwise → `joined`.
- Maps known Slack errors to `cannot_join` (never throws): `is_archived`,
  `method_not_supported_for_channel_type` (private), `missing_scope`, `channel_not_found`.
- Unexpected/unknown errors rethrow (caller catches and degrades to a warning).

Also exports the pure trigger helper (keeps route glue thin and unit-testable):

```ts
// backfill iff the channel is now enabled, wasn't before, and the bot can see it
shouldBackfill(prevEnabled: boolean, nextEnabled: boolean, botInChannel: boolean): boolean
// = nextEnabled && !prevEnabled && botInChannel
```

For create, pass `prevEnabled = false` (a new enabled channel is an enable transition).

### Refactor: extract `reconcileChannel(channel)` — `src/lib/slack/reconcileChannels.ts`

Pull the per-channel body of `reconcileEnabledChannels` (history fetch → message filter loop →
upsert) into:

```ts
reconcileChannel(channel): Promise<{ processed: number; errors: number; notInChannel: boolean }>
```

`reconcileEnabledChannels` becomes a loop that calls `reconcileChannel` and aggregates results,
adding `notInChannel: string[]` (AO display names) to `ReconcileResult` for the Sync report.
The existing nightly-reconcile behavior is preserved and regression-tested through the extracted
function. Message filters (tombstone / thread_broadcast / thread replies / backblast-or-preblast)
are unchanged.

### API hooks

- **POST `/api/admin/ao-channels`** (after the insert): if the new row is `is_enabled`,
  `joinSlackChannel`; if `shouldBackfill(false, true, botInChannel)`, run `reconcileChannel` +
  `revalidatePath('/backblasts')` + `revalidatePath('/')`. Return `botStatus` alongside the channel.
- **PUT `/api/admin/ao-channels/[id]`**: SELECT the prior `is_enabled` before the update. After
  the update, if `nextEnabled` is true call `joinSlackChannel`; if
  `shouldBackfill(prevEnabled, nextEnabled, botInChannel)` run `reconcileChannel` + revalidate.
  A no-transition edit (already enabled, or staying disabled) skips join/backfill. Return `botStatus`.

```ts
botStatus: { joined: boolean; alreadyIn: boolean; backfilled: number; warning: string | null }
```

### Sync endpoint + reconcile result

`/api/admin/ao-channels/sync` and `/api/slack/reconcile` already call `reconcileEnabledChannels`;
extend their JSON responses to pass through `notInChannel` so the manager can show
`⚠️ Not in: <names>`.

### UI — AO Channel Manager (client component)

- After create/edit, render `botStatus` (success line or warning) inline.
- After Sync, render the `notInChannel` list if non-empty.
- No new always-on Slack calls; status shows only in response to an admin action.

## Error handling

- Slack/join/backfill exceptions are caught in the route; the row save is committed regardless.
  Worst case: channel saved, `botStatus.warning` explains the manual-invite next step.
- `reconcileChannel` keeps the existing per-message try/catch; a channel-level `not_in_channel`
  sets `notInChannel: true` rather than throwing.

## Testing (TDD)

- **Unit — `joinSlackChannel`:** mock `WebClient.conversations.join` for ok+joined,
  ok+already_in_channel, error `is_archived`, error `method_not_supported_for_channel_type`,
  error `missing_scope` → assert each `JoinOutcome`; unexpected error rethrows.
- **Unit — `reconcileChannel`:** mock history fetch + `sql`; assert backblast/preblast upsert,
  `not_in_channel` → `{ notInChannel: true, processed: 0 }`, and that non-backblast / thread /
  tombstone messages are skipped (filters preserved).
- **Unit — `shouldBackfill`:** truth-table — only `(prev=false, next=true, botIn=true)` returns
  true; already-enabled edits, staying-disabled, and `cannot_join` all return false.
- **Regression:** `reconcileEnabledChannels` still aggregates `processed`/`errors` across
  channels via the extracted `reconcileChannel`.

## Out of scope (YAGNI)

- Auto-join for **private** channels (API can't) — manual invite only, surfaced via warning.
- Always-on membership column / per-row live `conversations.info`.
- Retry/queue/background jobs — best-effort on the request.
- Recovering posts older than the channel's last-100 Slack history (matches current Sync).

---

Related: motivated by the 2026-05-22 missing-backblasts incident; `channels:join` scope added
the same day. Touches `src/lib/slack/`, `src/app/api/admin/ao-channels/`, and the manager UI.
