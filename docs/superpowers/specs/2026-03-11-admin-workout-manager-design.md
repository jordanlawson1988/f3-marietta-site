# Admin Workout Schedule Manager — Design Spec

**Date:** 2026-03-11
**Status:** Draft
**Author:** Jordan Lawson + Claude

## Problem

The F3 Marietta workouts page is database-driven via a `workout_schedule` Supabase table, but there is no admin UI to manage it. Changes require direct SQL or migration files. The site admin needs a visual interface to add, edit, remove, and reorganize workout entries — including the ability to manage which regions appear and how they're grouped on the public page.

## Goals

1. Admin can create, edit, deactivate, and delete workout schedule entries through a web UI
2. Admin can manage regions dynamically (add, rename, reorder, remove) instead of hard-coded region categories
3. The public workouts page renders sections dynamically based on region configuration
4. Bulk operations supported for efficient multi-workout changes
5. Consistent admin experience — shared sidebar navigation, same auth pattern as existing KB admin

## Non-Goals

- Audit logging / change history (can be added later)
- Draft/publish workflow
- Role-based access control (single password auth is sufficient)
- User-facing workout search or filtering

## Data Model

### New Table: `regions`

```sql
CREATE TABLE regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- `name`: Display name (e.g., "Marietta", "West Cobb", "Cherokee")
- `slug`: URL/code-friendly key (e.g., "marietta", "west-cobb")
- `sort_order`: Controls render order on the public page
- `is_primary`: Primary regions render as top-level section headers on the public page. Non-primary regions are grouped under an "Other Nearby" heading with their name shown as a badge on each workout card.
- `is_active`: Soft-delete. Inactive regions and their workouts are hidden from the public page.

### Changes to `workout_schedule`

- Add a new `region_id` column (uuid) referencing `regions.id`. This replaces the free-text `region` column.
- The `region` (free-text) and `nearby_region` columns will be dropped after migration.
- Using uuid FK (not slug FK) avoids cascade issues if an admin renames a region slug.

### Migration Strategy

1. Create the `regions` table
2. Seed it from the distinct `region` and `nearby_region` values currently in `workout_schedule`
   - "Marietta" → `{ name: "Marietta", slug: "marietta", is_primary: true, sort_order: 1 }`
   - "West Cobb" → `{ name: "West Cobb", slug: "west-cobb", is_primary: true, sort_order: 2 }`
   - Each distinct `nearby_region` value (e.g., "Atlanta", "Cherokee") → `{ name: "Atlanta", slug: "atlanta", is_primary: false, sort_order: 3+ }`
3. Add `region_id uuid` column to `workout_schedule`
4. Populate `region_id` by joining on existing `region`/`nearby_region` text values:
   - Rows with `region = 'Marietta'` → set `region_id` to the Marietta region's uuid
   - Rows with `region = 'West Cobb'` → set `region_id` to the West Cobb region's uuid
   - Rows with `region = 'Other Nearby'` → match `nearby_region` text (e.g., "Atlanta") to the corresponding region's uuid
5. Drop the CHECK constraint on the old `region` column: `ALTER TABLE workout_schedule DROP CONSTRAINT workout_schedule_region_check;`
6. Add foreign key: `ALTER TABLE workout_schedule ADD CONSTRAINT workout_schedule_region_id_fkey FOREIGN KEY (region_id) REFERENCES regions(id);`
7. Set `region_id` to NOT NULL
8. Drop old columns: `region`, `nearby_region`

## Admin Layout

### Shared Layout (`/admin/layout.tsx`)

The admin area gets a shared layout with:

- **Persistent left sidebar** containing:
  - Header: "F3 Marietta Admin"
  - Nav links: Knowledge Base, Workouts, Regions
  - Logout button at the bottom
- **Main content area** to the right of the sidebar
- **Auth gate**: The layout manages auth state (password + localStorage token). All admin sub-pages are protected. Same `ADMIN_DASHBOARD_PASSWORD` env var and `x-admin-token` header pattern as the existing KB admin.
- **localStorage key**: Unified to `"f3-admin-token"` (replacing the KB-specific `"f3-kb-admin-token"`). The KB page will be updated to use the shared key.
- **Admin is desktop-oriented.** No special mobile layout for the calendar grid. A brief note or min-width constraint is acceptable.

The existing `/admin/kb/page.tsx` will be refactored to work within this layout — its auth UI and sidebar are removed in favor of the shared layout.

### Route Structure

| Route | Purpose |
|-------|---------|
| `/admin` | Redirects to `/admin/workouts` (or shows a dashboard later) |
| `/admin/kb` | Existing Knowledge Base editor |
| `/admin/workouts` | Workout schedule calendar grid manager |
| `/admin/regions` | Region CRUD manager |

## Workouts Admin Page (`/admin/workouts`)

### Calendar Grid View

A 7-column grid (Monday–Sunday) displaying workout blocks stacked vertically within each day column. Blocks within each column are sorted by `start_time` ascending.

**Each workout block shows:**
- AO name (bold)
- Workout type (colored text)
- Start time
- Region name (subtle text)
- Checkbox for bulk selection
- Color-coded left border by workout type (blue = Bootcamp, green = Run, gold = Ruck, etc.)
- Inactive workouts shown with reduced opacity and an "Inactive" badge

**Toolbar above the grid:**
- Region filter pills (All, Marietta, West Cobb, etc.) — show/hide workouts by region
- "Bulk Actions" dropdown (appears when checkboxes are selected): Deactivate, Delete, Change Region
- "+ Add Workout" button

**Per-column "+" button:**
- Dashed "+ Add" button at the bottom of each day column
- Opens the create modal with that day pre-selected

**Empty day columns** show "No workouts" placeholder text with the "+ Add" button.

### Edit/Create Modal

A centered modal dialog with the following fields:

| Field | Type | Notes |
|-------|------|-------|
| AO Name | Text input | Required |
| Workout Type | Combobox | Free-text with suggestions: Bootcamp, Run, Ruck, CSAUP, Convergence. Allows custom values for non-standard types. |
| Day of Week | Dropdown | Monday–Sunday. Pre-filled when clicking a day column's "+ Add" |
| Start Time | Time picker | Native HTML time input |
| End Time | Time picker | Native HTML time input |
| Region | Dropdown | Populated from `regions` table (active regions only) |
| Location Name | Text input | Park name, school name, etc. |
| Address | Text input | Full street address |
| Map Link | URL input | Optional. Google Maps or F3 Nation map link |
| Active | Toggle switch | Inactive workouts hidden from public page |

**Modal footer:**
- Delete button (left side, red) — with confirmation prompt. Only shown in edit mode.
- Cancel button (right side)
- Save Changes / Create button (right side, primary)

## Regions Admin Page (`/admin/regions`)

A table/list view showing all regions with columns:

| Column | Description |
|--------|-------------|
| Name | Editable display name |
| Slug | Auto-generated from name on create, immutable after creation |
| Sort Order | Numeric input controlling public page render order |
| Primary | Toggle — primary regions get their own section header |
| Active | Toggle — inactive regions hidden from public page |
| Actions | Edit, Delete |

**Features:**
- "Add Region" button at top
- Click row to edit via modal or inline
- Delete only allowed if no workouts (active or inactive) reference the region. Shows error with count of referencing workouts otherwise.
- Sort order controls the sequence regions appear on the public workouts page

## API Routes

All routes require `x-admin-token` header matching `ADMIN_DASHBOARD_PASSWORD` env var.

### Workout Routes

| Route | Method | Request Body | Response |
|-------|--------|-------------|----------|
| `/api/admin/workouts` | GET | — | `{ workouts: WorkoutScheduleRow[] }` (returns all workouts, active + inactive) |
| `/api/admin/workouts` | POST | `WorkoutScheduleRow` (without id) | `{ workout: WorkoutScheduleRow }` |
| `/api/admin/workouts/[id]` | PUT | Partial `WorkoutScheduleRow` | `{ workout: WorkoutScheduleRow }` |
| `/api/admin/workouts/[id]` | DELETE | — | `{ success: true }` |
| `/api/admin/workouts/bulk` | POST | `{ action: 'deactivate' \| 'delete' \| 'change_region', ids: string[], region_id?: string }` | `{ success: true, affected: number }` |

**Bulk endpoint validation:**
- `ids` must be a non-empty array of valid UUIDs
- When `action` is `'change_region'`, `region_id` is required and must reference an existing active region. Returns `400` with error message if missing or invalid.
- When `action` is `'delete'`, a confirmation flag `confirm: true` is required to prevent accidental bulk deletes.

### Region Routes

| Route | Method | Request Body | Response |
|-------|--------|-------------|----------|
| `/api/admin/regions` | GET | — | `{ regions: Region[] }` |
| `/api/admin/regions` | POST | `{ name, slug?, sort_order?, is_primary? }` | `{ region: Region }` |
| `/api/admin/regions/[id]` | PUT | Partial Region fields | `{ region: Region }` |
| `/api/admin/regions/[id]` | DELETE | — | `{ success: true }` or `{ error: "Region has N workout(s)" }` |

**`updated_at` handling:** All PUT routes explicitly set `updated_at = now()` in the UPDATE query. No database triggers needed.

## Updated TypeScript Interfaces

### `src/types/workout.ts`

```typescript
export interface WorkoutScheduleRow {
  id: string;
  ao_name: string;
  workout_type: string;
  day_of_week: number;       // 1 (Mon) – 7 (Sun), ISO
  start_time: string;        // HH:MM:SS
  end_time: string;          // HH:MM:SS
  location_name: string | null;
  address: string;
  region_id: string;         // uuid FK to regions.id
  map_link: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
```

Note: `region` (free-text) and `nearby_region` are removed. Replaced by `region_id`.

### `src/types/region.ts` (new)

```typescript
export interface Region {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
```

## Error Handling & UI State

Follow the existing KB admin pattern:
- Inline `message` (green) and `error` (red) strings displayed in the toolbar/header area
- Loading spinner/text during data fetches
- `isSaving` state disables Save button to prevent double-submit
- On API error, display the error message from the response body
- On success, refetch the data to ensure UI reflects server state (no optimistic updates)
- Delete actions require a confirmation prompt before executing

## Public Workouts Page Updates

### `getWorkoutSchedule.ts`

Currently returns `Map<number, DaySchedule>` where `DaySchedule` has hard-coded keys `{ marietta, westCobb, otherNearby }`.

**Updated behavior:**
- Fetches active regions from `regions` table (ordered by `sort_order`)
- Fetches active workouts joined with `regions` on `region_id`, groups them by day and region
- Returns a structure with dynamic region keys:

```typescript
interface RegionInfo {
  name: string;
  slug: string;
  is_primary: boolean;
  sort_order: number;
}

interface DaySchedule {
  regions: {
    region: RegionInfo;
    workouts: WorkoutScheduleRow[];
  }[];
}
```

### `WorkoutSchedule.tsx`

Updated to render dynamically:
- Iterates over `regions` in each day's schedule
- Primary regions render with their name as the section heading
- Non-primary regions are collected and rendered under a single "Other Nearby" heading, with each workout card showing its region name as a badge (same visual treatment as the current `nearby_region` badge)

## Component Structure

```
src/app/admin/
  layout.tsx                  — Shared sidebar + auth gate
  page.tsx                    — Redirect to /admin/workouts

  kb/
    page.tsx                  — Existing KB editor (refactored into layout)

  workouts/
    page.tsx                  — Calendar grid view + toolbar
    WorkoutGrid.tsx           — 7-column calendar grid component
    WorkoutBlock.tsx           — Individual workout card in the grid
    WorkoutModal.tsx           — Create/edit modal dialog

  regions/
    page.tsx                  — Region table/list with CRUD

src/app/api/admin/
  workouts/
    route.ts                  — GET (list), POST (create)
    [id]/route.ts             — PUT (update), DELETE (remove)
    bulk/route.ts             — POST (bulk actions)
  regions/
    route.ts                  — GET (list), POST (create)
    [id]/route.ts             — PUT (update), DELETE (remove)
```

## Testing

Playwright E2E tests covering:
- Admin login flow
- Workout CRUD: create, edit fields, deactivate, delete
- Bulk operations: select multiple, bulk deactivate
- Region CRUD: create, edit, reorder, delete (blocked when in use)
- Public page: verify dynamic regions render correctly
- Edge cases: empty days, single workout day, all regions inactive
