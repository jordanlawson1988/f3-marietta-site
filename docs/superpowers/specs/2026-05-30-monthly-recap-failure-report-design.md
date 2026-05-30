# Monthly Recap Failure Report — Design Spec

**Date:** 2026-05-30
**Status:** Approved for implementation
**Branch:** `feature/recap-failure-report`

## Problem

The monthly PAX recap cron (`/api/cron/monthly-pax-recap`, fires `0 12 1 * *`)
DMs each active PAX their prior-month stats. Today it has **two blind spots**:

1. **Send errors are invisible.** When `chat.postMessage` throws for a PAX, the
   error is collected into the route's `errors[]` array — but that array only
   exists in the HTTP JSON response, which Vercel cron fires and discards. No
   human ever sees it.
2. **Unreachable PAX are silently dropped.** In `getMonthlyPaxRecap`, any PAX
   who posted last month but has **no resolvable Slack user ID** (nickname-only,
   no mapping) is `continue`-d past before a send is ever attempted. They get no
   recap and are never counted or reported.

Jordan wants a list of failures — *who specifically* the method failed for —
delivered at the end of the run so he can correct what's correctable.

## Goals

- After each run, **DM a failure/run report to an admin** (`SLACK_ADMIN_USER_ID`).
- Report covers **both** failure classes: send errors and unreachable PAX.
- Generated in **both live and dry-run** modes (clearly labeled), so the report
  can be previewed before the next live fire (June 1).
- Report formatting is a **pure function** with full unit-test coverage.
- **No crash coupling:** a reporting failure must never crash the run or mask
  send results.

## Non-Goals (YAGNI)

- No DB run-log table (no schema change; shared DB stays untouched).
- No admin-UI rendering of the report. (The preview *endpoint* JSON gains an
  `unreachable` field for free, but no React work this round.)
- No change to the recap message content or the send mechanism itself.
- Not fixing the cosmetic "U-token with no display name greets by raw ID" edge
  (see Known Limitations) — tracked, out of scope for v1.

## Failure Classes

| Class | Definition | Correctable by |
|---|---|---|
| **Send error** | PAX had a Slack ID; `chat.postMessage` threw (e.g. `cannot_dm_user`, `user_not_found`) | Investigating the Slack error code per PAX |
| **Unreachable** | PAX posted in the window but `resolveSlackId` returned `null` (nickname-only, unmapped) | Adding a Slack alias/mapping for that nickname |

Note: a `U`-prefixed token that isn't in `slack_users` is still treated as
**reachable** (valid Slack ID, DM-able) and remains a recipient — unchanged.

## Architecture

Four code changes + tests. No migration.

### 1. `src/lib/stats/getMonthlyPaxRecap.ts` — surface unreachable PAX

Extract the in-memory aggregation into a **pure function** so the unreachable
logic is testable without a DB, and change the return shape.

```ts
export type UnreachableRow = {
  paxToken: string;                 // original token, e.g. "n:bulldog"
  paxLabel: string;                 // human label, e.g. "bulldog"
  posts: number;                    // distinct events in the window
  reason: "no-slack-mapping";
};

export type RecapAggregate = {
  recipients: PaxRecapRow[];
  unreachable: UnreachableRow[];
};

// Pure — no I/O. Tests construct fact rows + maps directly.
export function aggregateRecapRows(
  fact: FactRow[],
  maps: {
    nameById: Map<string, string>;
    idByName: Map<string, string>;
    aliasMap: Map<string, string>;
  },
): RecapAggregate;
```

- `getMonthlyPaxRecap(range)` now does the SQL, builds the maps, calls
  `aggregateRecapRows`, and returns `RecapAggregate` (was `PaxRecapRow[]`).
- Unreachable bucket: for every fact row whose token resolves to `null`,
  aggregate by `paxToken`, count distinct `eventId`s as `posts`, label = the
  nickname (`token.slice(2)` for `n:` tokens) else the raw token.
- Both lists sorted by `posts` desc (recipients already are; unreachable too —
  most active first, since those are the most worth mapping).
- Error fallback: on DB failure, return `{ recipients: [], unreachable: [] }`.

### 2. `src/lib/stats/buildPaxRecap.ts` — thread `unreachable` through the plan

```ts
export type RecapPlan = {
  window: RecapWindow;
  recipients: PaxRecapRow[];
  unreachable: UnreachableRow[];   // NEW
  sample: RecapSample | null;
};
```

`planMonthlyRecap` destructures `{ recipients, unreachable }` from
`getMonthlyPaxRecap` and includes `unreachable` in the returned plan.

### 3. `src/lib/stats/recapReport.ts` (NEW) — pure report formatter

```ts
export type RecapRunReportInput = {
  window: RecapWindow;             // { from, to, monthLabel }
  mode: "live" | "dry-run";
  recipientsCount: number;
  sent: number;
  errors: Array<{ slackUserId: string; paxLabel: string; error: string }>;
  unreachable: UnreachableRow[];
  maxListItems?: number;           // default 25
};

export function buildRecapRunReport(input: RecapRunReportInput): string;
```

Behavior:
- **Header:** `F3 Marietta — Monthly Recap Run ({monthLabel})` + a stats line:
  `Mode: {mode} · Recipients: N · Sent: N · Failed: N · Unreachable: N`.
- **Send-failures section** (omitted if none): one bullet per PAX —
  `• {paxLabel} ({slackUserId}) — {error}`.
- **Unreachable section** (omitted if none): one bullet per PAX —
  `• "{paxLabel}" — {posts} post(s)`, followed by the explanatory line
  *"These posted in {month} but have no Slack ID → got no recap. Add a mapping."*
- **All-clear** (0 failed, 0 unreachable, recipients > 0):
  one line — `✅ All N delivered · 0 unreachable`.
- **Nothing-to-do** (0 recipients, 0 unreachable):
  `No PAX posted in {month} — nothing to recap.`
- **Pluralization** handled (`post`/`posts`, etc.).
- **Truncation:** each list capped at `maxListItems` (default 25); overflow
  appends `…and N more` (NOT silent — the count is shown).

Pure → unit-testable, matches the existing `buildRecapMessage` style.

### 4. `src/app/api/cron/monthly-pax-recap/route.ts` — wire report into both paths

- `planMonthlyRecap()` now yields `unreachable`; carry it everywhere.
- After the send loop (live) **and** in the dry-run branch, build the report and
  DM it to the admin:

```ts
async function postAdminReport(report: string): Promise<{ posted: boolean; error: string | null }> {
  const adminId = process.env.SLACK_ADMIN_USER_ID;
  if (!adminId) return { posted: false, error: "SLACK_ADMIN_USER_ID not set" };
  try {
    await getSlackClient().chat.postMessage({
      channel: adminId, text: report, unfurl_links: false,
    });
    return { posted: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[monthly-pax-recap] admin report post failed:", msg);
    return { posted: false, error: msg };
  }
}
```

- Wrapped so a report failure never throws out of the handler.
- JSON response gains: `unreachable` (array), `reportPosted` (bool),
  `reportError` (string | null).
- When `recipients.length === 0`, skip the send loop but still build + post the
  report — it surfaces the unreachable list if any. The formatter collapses to
  the "nothing-to-recap" one-liner only when unreachable is *also* empty. Then
  return.

### 5. `src/app/api/admin/monthly-pax-recap/preview/route.ts` — minor

Include `unreachable` (and its count) in the preview endpoint's JSON response so
the data is available to the admin surface later. No UI change this round.

## Data Flow

```
cron GET
  └─ planMonthlyRecap(now)
       └─ getMonthlyPaxRecap(range)
            ├─ SQL (attendance fact + slack_users + aliasMap)
            └─ aggregateRecapRows(fact, maps) → { recipients, unreachable }
  ├─ [live]  for each recipient: chat.postMessage → sent++ / errors.push
  ├─ [dry]   no sends; errors = [], sent = 0
  └─ buildRecapRunReport({ window, mode, recipientsCount, sent, errors, unreachable })
       └─ postAdminReport(report) → DM to SLACK_ADMIN_USER_ID  (try/catch)
  └─ JSON { window, mode, recipients, sent, skipped, errors, unreachable, reportPosted, reportError, sample }
```

## Error Handling

- Report build is pure and total (always returns a string).
- `postAdminReport` swallows its own errors → logged + surfaced in JSON as
  `reportError`, never thrown.
- `SLACK_ADMIN_USER_ID` unset → report skipped, `reportError` notes it. No crash.
- `getSlackClient()` missing token → caught inside `postAdminReport`.
- Existing per-recipient send error handling is unchanged.

## Configuration

- **New env var:** `SLACK_ADMIN_USER_ID` — the Slack user ID to DM the report to.
  Added by Jordan to `.env.local` (local) and Vercel (prod). The agent will NOT
  edit `.env.local`. Unset is safe (report skipped).

## Testing (TDD)

`tests/recapReport.test.ts` — pure formatter:
- all-clear → one-liner
- nothing-to-do (0/0)
- send-errors only
- unreachable only
- both classes
- singular vs plural grammar (1 post vs N posts; 1 failure vs N)
- truncation: list > maxListItems appends `…and N more`, count correct
- mode label reflects `live` vs `dry-run`
- unreachable sorted by posts desc

`tests/aggregateRecapRows.test.ts` — pure aggregator:
- `n:`-unmapped token → unreachable, with correct post count & label
- `n:`-mapped token → recipient (not unreachable)
- `U`-token not in slack_users → still a recipient (reachable)
- distinct-event post counting (dup eventIds not double-counted)
- both lists sorted by posts desc

Run via existing `npm run test:unit` (`tsx --test tests/*.test.ts`).

## Rollout

1. Implement on `feature/recap-failure-report` (TDD), `tsc` + tests + build green.
2. Jordan adds `SLACK_ADMIN_USER_ID` to `.env.local` and Vercel.
3. Optional pre-June-1 dry-run: hit the cron URL in dry-run to preview the
   unreachable list and verify the DM lands.
4. PR `feature/recap-failure-report` → `develop` → `main` per standard flow.

## Known Limitations

- A `U`-prefixed token with no display name remains a recipient and is greeted
  by its raw ID ("Hey U0A4…"). Cosmetic, pre-existing; not addressed here.
- No retry/idempotency on the report DM itself (single attempt; logged on fail).
- No persistence/history — each report is ephemeral in Slack. (DB log was an
  explicit non-goal.)
