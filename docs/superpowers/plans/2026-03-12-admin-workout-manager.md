# Admin Workout Schedule Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin console for managing workout schedules and regions, replacing direct SQL with a visual calendar grid UI.

**Architecture:** New `regions` table + FK migration on `workout_schedule`. Shared admin layout with sidebar navigation. Calendar grid view for workouts, table view for regions. Same password-based auth pattern as existing KB admin.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL), Playwright for E2E tests.

**Spec:** `docs/superpowers/specs/2026-03-11-admin-workout-manager-design.md`

---

## Chunk 1: Database Migration & Types

### Task 1: Create the regions table and migrate workout_schedule

**Files:**
- Create: `supabase/migrations/20260312_regions_and_workout_fk.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 1. Create the regions table
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

-- 2. Seed regions from existing workout_schedule data
INSERT INTO regions (name, slug, sort_order, is_primary) VALUES
  ('Marietta', 'marietta', 1, true),
  ('West Cobb', 'west-cobb', 2, true);

-- Seed non-primary regions from distinct nearby_region values
INSERT INTO regions (name, slug, sort_order, is_primary)
SELECT DISTINCT
  nearby_region,
  lower(replace(nearby_region, ' ', '-')),
  2 + row_number() OVER (ORDER BY nearby_region),
  false
FROM workout_schedule
WHERE nearby_region IS NOT NULL AND nearby_region != '';

-- 3. Add region_id column to workout_schedule
ALTER TABLE workout_schedule ADD COLUMN region_id uuid;

-- 4. Populate region_id from existing region/nearby_region text values
UPDATE workout_schedule ws
SET region_id = r.id
FROM regions r
WHERE ws.region = 'Marietta' AND r.slug = 'marietta';

UPDATE workout_schedule ws
SET region_id = r.id
FROM regions r
WHERE ws.region = 'West Cobb' AND r.slug = 'west-cobb';

UPDATE workout_schedule ws
SET region_id = r.id
FROM regions r
WHERE ws.region = 'Other Nearby'
  AND r.name = ws.nearby_region;

-- 5. Drop the CHECK constraint on the old region column
ALTER TABLE workout_schedule DROP CONSTRAINT workout_schedule_region_check;

-- 6. Add foreign key constraint
ALTER TABLE workout_schedule
  ADD CONSTRAINT workout_schedule_region_id_fkey
  FOREIGN KEY (region_id) REFERENCES regions(id);

-- 7. Set region_id to NOT NULL
ALTER TABLE workout_schedule ALTER COLUMN region_id SET NOT NULL;

-- 8. Drop old columns
ALTER TABLE workout_schedule DROP COLUMN region;
ALTER TABLE workout_schedule DROP COLUMN nearby_region;

-- 9. Add index for region_id lookups
CREATE INDEX idx_workout_schedule_region_id ON workout_schedule(region_id);
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Open Supabase dashboard > SQL Editor > paste and execute the migration.
Verify: `SELECT * FROM regions;` should return seeded rows.
Verify: `SELECT id, ao_name, region_id FROM workout_schedule LIMIT 5;` should show uuid region_ids.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260312_regions_and_workout_fk.sql
git commit -m "feat: add regions table and migrate workout_schedule FK"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/types/workout.ts`
- Create: `src/types/region.ts`

- [ ] **Step 1: Update WorkoutScheduleRow type**

Replace contents of `src/types/workout.ts`:

```typescript
export interface WorkoutScheduleRow {
  id: string;
  ao_name: string;
  workout_type: string;
  day_of_week: number; // 1 (Mon) – 7 (Sun), ISO
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  location_name: string | null;
  address: string;
  region_id: string; // uuid FK to regions.id
  map_link: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
```

- [ ] **Step 2: Create Region type**

Create `src/types/region.ts`:

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

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Type errors in files that reference old `region`/`nearby_region` fields (this is expected — we'll fix them in subsequent tasks).

- [ ] **Step 4: Commit**

```bash
git add src/types/workout.ts src/types/region.ts
git commit -m "feat: update WorkoutScheduleRow type and add Region type"
```

---

## Chunk 2: API Routes

### Task 3: Create admin auth helper

**Files:**
- Create: `src/lib/admin/auth.ts`

- [ ] **Step 1: Extract shared auth check**

The existing KB routes duplicate auth logic. Extract it into a shared helper.

Create `src/lib/admin/auth.ts`:

```typescript
import { NextResponse } from "next/server";

/**
 * Validates the admin token from request headers.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateAdminToken(
  request: Request
): NextResponse | null {
  const token = request.headers.get("x-admin-token");
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "Admin password not configured" },
      { status: 500 }
    );
  }

  if (token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null; // Auth passed
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/auth.ts
git commit -m "refactor: extract shared admin auth helper"
```

---

### Task 4: Create regions API routes

**Files:**
- Create: `src/app/api/admin/regions/route.ts`
- Create: `src/app/api/admin/regions/[id]/route.ts`

- [ ] **Step 1: Create GET and POST route for regions**

Create `src/app/api/admin/regions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ regions: data });
}

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const { name, slug, sort_order, is_primary } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const regionSlug =
    slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { data, error } = await supabase
    .from("regions")
    .insert({
      name,
      slug: regionSlug,
      sort_order: sort_order ?? 0,
      is_primary: is_primary ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ region: data }, { status: 201 });
}
```

- [ ] **Step 2: Create PUT and DELETE route for regions**

Create `src/app/api/admin/regions/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Slug is immutable after creation — remove it if present
  const { slug: _slug, id: _id, created_at: _ca, ...updates } = body;

  const { data, error } = await supabase
    .from("regions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ region: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;

  // Check if any workouts reference this region
  const { count } = await supabase
    .from("workout_schedule")
    .select("id", { count: "exact", head: true })
    .eq("region_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Region has ${count} workout(s). Remove or reassign them first.` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("regions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/regions/route.ts src/app/api/admin/regions/\[id\]/route.ts
git commit -m "feat: add regions admin API routes (CRUD)"
```

---

### Task 5: Create workouts API routes

**Files:**
- Create: `src/app/api/admin/workouts/route.ts`
- Create: `src/app/api/admin/workouts/[id]/route.ts`
- Create: `src/app/api/admin/workouts/bulk/route.ts`

- [ ] **Step 1: Create GET and POST route for workouts**

Create `src/app/api/admin/workouts/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("workout_schedule")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workouts: data });
}

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const {
    ao_name,
    workout_type,
    day_of_week,
    start_time,
    end_time,
    location_name,
    address,
    region_id,
    map_link,
    is_active,
  } = body;

  if (!ao_name || !workout_type || !day_of_week || !start_time || !end_time || !address || !region_id) {
    return NextResponse.json(
      { error: "Missing required fields: ao_name, workout_type, day_of_week, start_time, end_time, address, region_id" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("workout_schedule")
    .insert({
      ao_name,
      workout_type,
      day_of_week,
      start_time,
      end_time,
      location_name: location_name || null,
      address,
      region_id,
      map_link: map_link || null,
      is_active: is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workout: data }, { status: 201 });
}
```

- [ ] **Step 2: Create PUT and DELETE route for single workout**

Create `src/app/api/admin/workouts/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Remove non-updatable fields
  const { id: _id, created_at: _ca, ...updates } = body;

  const { data, error } = await supabase
    .from("workout_schedule")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workout: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;

  const { error } = await supabase
    .from("workout_schedule")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create bulk actions route**

Create `src/app/api/admin/workouts/bulk/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateAdminToken } from "@/lib/admin/auth";

export async function POST(request: Request) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const body = await request.json();
  const { action, ids, region_id, confirm } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids must be a non-empty array" },
      { status: 400 }
    );
  }

  if (!["deactivate", "delete", "change_region"].includes(action)) {
    return NextResponse.json(
      { error: "action must be one of: deactivate, delete, change_region" },
      { status: 400 }
    );
  }

  if (action === "change_region") {
    if (!region_id) {
      return NextResponse.json(
        { error: "region_id is required for change_region action" },
        { status: 400 }
      );
    }
    // Verify region exists and is active
    const { data: region } = await supabase
      .from("regions")
      .select("id")
      .eq("id", region_id)
      .eq("is_active", true)
      .single();

    if (!region) {
      return NextResponse.json(
        { error: "Invalid or inactive region_id" },
        { status: 400 }
      );
    }
  }

  if (action === "delete" && !confirm) {
    return NextResponse.json(
      { error: "confirm: true is required for bulk delete" },
      { status: 400 }
    );
  }

  let result;

  switch (action) {
    case "deactivate":
      result = await supabase
        .from("workout_schedule")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", ids);
      break;

    case "delete":
      result = await supabase
        .from("workout_schedule")
        .delete()
        .in("id", ids);
      break;

    case "change_region":
      result = await supabase
        .from("workout_schedule")
        .update({ region_id, updated_at: new Date().toISOString() })
        .in("id", ids);
      break;
  }

  if (result?.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, affected: ids.length });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/workouts/route.ts src/app/api/admin/workouts/\[id\]/route.ts src/app/api/admin/workouts/bulk/route.ts
git commit -m "feat: add workouts admin API routes (CRUD + bulk)"
```

---

## Chunk 3: Shared Admin Layout

### Task 6: Create shared admin layout with sidebar

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Modify: `src/app/admin/kb/page.tsx`

- [ ] **Step 1: Create the admin layout**

Create `src/app/admin/layout.tsx`:

```typescript
"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  BookOpen,
  Dumbbell,
  MapPin,
  LogOut,
} from "lucide-react";

// --- Admin Auth Context ---

interface AdminAuthContext {
  token: string | null;
  logout: () => void;
}

const AuthContext = createContext<AdminAuthContext>({
  token: null,
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AuthContext);
}

// --- Nav Items ---

const NAV_ITEMS = [
  { href: "/admin/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/admin/regions", label: "Regions", icon: MapPin },
  { href: "/admin/kb", label: "Knowledge Base", icon: BookOpen },
];

// --- Layout Component ---

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Migrate old KB token key to new unified key
    const oldToken = localStorage.getItem("f3-kb-admin-token");
    const newToken = localStorage.getItem("f3-admin-token");
    if (oldToken && !newToken) {
      localStorage.setItem("f3-admin-token", oldToken);
      localStorage.removeItem("f3-kb-admin-token");
    }

    const saved = localStorage.getItem("f3-admin-token");
    if (saved) {
      setToken(saved);
    }
  }, []);

  const handleLogin = async () => {
    if (!password) return;
    setIsLoading(true);
    setError("");
    try {
      // Validate password by hitting any admin endpoint
      const res = await fetch("/api/admin/regions", {
        headers: { "x-admin-token": password },
      });
      if (res.ok) {
        setToken(password);
        localStorage.setItem("f3-admin-token", password);
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("f3-admin-token");
  };

  // --- Login Screen ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
        <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl">
          <h1 className="text-2xl font-bold mb-6 text-center">
            F3 Marietta Admin
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Unlocking..." : "Unlock"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated Layout ---
  return (
    <AuthContext.Provider value={{ token, logout }}>
      <div className="min-h-screen bg-[#0A1A2F] text-white flex">
        {/* Sidebar */}
        <div className="w-56 bg-[#112240] border-r border-[#23334A] flex flex-col shrink-0 h-screen sticky top-0">
          <div className="p-4 border-b border-[#23334A]">
            <h2 className="font-bold text-sm tracking-wide text-gray-300">
              F3 Marietta Admin
            </h2>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                    isActive
                      ? "bg-[#4A76A8] text-white font-medium"
                      : "text-gray-400 hover:bg-[#23334A] hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-2 border-t border-[#23334A]">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-400 hover:bg-[#23334A] hover:text-white transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Create the admin index redirect**

Create `src/app/admin/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/workouts");
}
```

- [ ] **Step 3: Refactor KB page to use shared layout auth**

Modify `src/app/admin/kb/page.tsx`:

Remove the login screen, sidebar, and auth state from the KB page. Replace with the shared `useAdminAuth()` hook. Key changes:

1. Remove the `password`, `token` state declarations and the login/logout functions
2. Import and use `useAdminAuth` from the layout
3. Remove the login screen render (`if (!token)` block)
4. Remove the KB page's own sidebar — the shared layout provides it
5. Update localStorage key references from `"f3-kb-admin-token"` to `"f3-admin-token"`
6. The KB page becomes just the main content area (file browser + editor)

The `token` value comes from `const { token } = useAdminAuth();` and is used in all API calls via the `x-admin-token` header, same as before.

- [ ] **Step 4: Verify KB admin still works**

Run: `npm run dev`
Navigate to `http://localhost:3000/admin` — should see login screen.
After login, sidebar should show with KB, Workouts, Regions links.
Navigate to `/admin/kb` — should show the KB editor, fully functional.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/kb/page.tsx
git commit -m "feat: add shared admin layout with sidebar navigation"
```

---

## Chunk 4: Regions Admin Page

### Task 7: Build the regions admin page

**Files:**
- Create: `src/app/admin/regions/page.tsx`

- [ ] **Step 1: Create the regions management page**

Create `src/app/admin/regions/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAdminAuth } from "../layout";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { Region } from "@/types/region";

export default function RegionsAdminPage() {
  const { token } = useAdminAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRegions = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/regions", {
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        const data = await res.json();
        setRegions(data.regions);
      }
    } catch {
      setError("Failed to fetch regions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegions();
  }, [token]);

  const openCreateModal = () => {
    setEditingRegion(null);
    setFormName("");
    setFormSlug("");
    setFormSortOrder(regions.length + 1);
    setFormIsPrimary(false);
    setFormIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (region: Region) => {
    setEditingRegion(region);
    setFormName(region.name);
    setFormSlug(region.slug);
    setFormSortOrder(region.sort_order);
    setFormIsPrimary(region.is_primary);
    setFormIsActive(region.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!token || !formName) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const url = editingRegion
        ? `/api/admin/regions/${editingRegion.id}`
        : "/api/admin/regions";

      const method = editingRegion ? "PUT" : "POST";

      const body = editingRegion
        ? { name: formName, sort_order: formSortOrder, is_primary: formIsPrimary, is_active: formIsActive }
        : { name: formName, slug: formSlug || undefined, sort_order: formSortOrder, is_primary: formIsPrimary, is_active: formIsActive };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage(editingRegion ? "Region updated." : "Region created.");
        setShowModal(false);
        fetchRegions();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Error saving region");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (region: Region) => {
    if (!token) return;
    if (!window.confirm(`Delete region "${region.name}"? This cannot be undone.`)) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/regions/${region.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });

      if (res.ok) {
        setMessage("Region deleted.");
        fetchRegions();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Error deleting region");
    }
  };

  // Auto-generate slug from name (only for new regions)
  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingRegion) {
      setFormSlug(
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Regions</h1>
        <div className="flex items-center gap-3">
          {message && <span className="text-green-400 text-sm">{message}</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Region
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-[#112240] rounded-lg border border-[#23334A] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#23334A] text-left">
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Slug</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Order</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Primary</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Active</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.id}
                  className="border-b border-[#23334A] last:border-0 hover:bg-[#1a2d45] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-white">{region.name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{region.slug}</td>
                  <td className="px-4 py-3 text-gray-400 text-center">{region.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    {region.is_primary ? (
                      <Check className="h-4 w-4 text-green-400 inline" />
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {region.is_active ? (
                      <Check className="h-4 w-4 text-green-400 inline" />
                    ) : (
                      <X className="h-4 w-4 text-red-400 inline" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(region)}
                        className="p-1.5 rounded hover:bg-[#23334A] text-gray-400 hover:text-white transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(region)}
                        className="p-1.5 rounded hover:bg-[#23334A] text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {regions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No regions yet. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#112240] p-6 rounded-lg border border-[#23334A] w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {editingRegion ? "Edit Region" : "Add Region"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                  placeholder="e.g. Marietta"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Slug {editingRegion && <span className="text-gray-600 normal-case">(immutable)</span>}
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => !editingRegion && setFormSlug(e.target.value)}
                  disabled={!!editingRegion}
                  className={cn(
                    "w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-sm font-mono",
                    editingRegion ? "text-gray-500 cursor-not-allowed" : "text-white"
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPrimary}
                    onChange={(e) => setFormIsPrimary(e.target.checked)}
                    className="accent-[#4A76A8]"
                  />
                  <span className="text-sm text-gray-300">Primary region</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="accent-[#4A76A8]"
                  />
                  <span className="text-sm text-gray-300">Active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={!formName || isSaving}
                >
                  {isSaving ? "Saving..." : editingRegion ? "Save Changes" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify regions page works**

Run: `npm run dev`
Navigate to `/admin/regions` — should show seeded regions from migration.
Test: Create a new region, edit an existing one, try to delete one with workouts (should show error).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/regions/page.tsx
git commit -m "feat: add regions admin page with CRUD"
```

---

## Chunk 5: Workouts Admin Page

### Task 8: Build the workout calendar grid page

**Files:**
- Create: `src/app/admin/workouts/page.tsx`
- Create: `src/app/admin/workouts/WorkoutGrid.tsx`
- Create: `src/app/admin/workouts/WorkoutBlock.tsx`
- Create: `src/app/admin/workouts/WorkoutModal.tsx`

- [ ] **Step 1: Create WorkoutBlock component**

Create `src/app/admin/workouts/WorkoutBlock.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

const TYPE_COLORS: Record<string, string> = {
  Bootcamp: "#4A76A8",
  Run: "#2ea87a",
  Running: "#2ea87a",
  Ruck: "#c59a2e",
  CSAUP: "#a855f7",
  Convergence: "#ec4899",
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || "#6b7f96";
}

interface WorkoutBlockProps {
  workout: WorkoutScheduleRow;
  region?: Region;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: (workout: WorkoutScheduleRow) => void;
}

export function WorkoutBlock({
  workout,
  region,
  isSelected,
  onSelect,
  onClick,
}: WorkoutBlockProps) {
  const color = getTypeColor(workout.workout_type);
  const [h, m] = workout.start_time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const timeStr = `${h12}:${m} ${ampm}`;

  return (
    <div
      className={cn(
        "bg-[#112240] border border-[#23334A] rounded cursor-pointer text-xs relative group",
        !workout.is_active && "opacity-50"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
      onClick={() => onClick(workout)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(workout.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 accent-[#4A76A8]"
      />
      <div className="p-1.5 pr-6">
        <div className="font-bold text-[#e2e8f0] leading-tight">
          {workout.ao_name}
        </div>
        <div style={{ color }} className="text-[10px] mt-0.5">
          {workout.workout_type}
        </div>
        <div className="text-[#6b7f96] text-[10px] mt-0.5">{timeStr}</div>
        {region && (
          <div className="text-[#4a5e73] text-[9px] mt-0.5">
            {region.name}
          </div>
        )}
        {!workout.is_active && (
          <div className="text-[9px] text-red-400 mt-0.5">Inactive</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WorkoutModal component**

Create `src/app/admin/workouts/WorkoutModal.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAdminAuth } from "../layout";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

const WORKOUT_TYPE_SUGGESTIONS = [
  "Bootcamp",
  "Run",
  "Ruck",
  "CSAUP",
  "Convergence",
];

const DAY_NAMES = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

interface WorkoutModalProps {
  workout: WorkoutScheduleRow | null; // null = create mode
  regions: Region[];
  defaultDay?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function WorkoutModal({
  workout,
  regions,
  defaultDay,
  onClose,
  onSaved,
}: WorkoutModalProps) {
  const { token } = useAdminAuth();
  const isEdit = !!workout;

  const [aoName, setAoName] = useState(workout?.ao_name ?? "");
  const [workoutType, setWorkoutType] = useState(workout?.workout_type ?? "Bootcamp");
  const [dayOfWeek, setDayOfWeek] = useState(workout?.day_of_week ?? defaultDay ?? 1);
  const [startTime, setStartTime] = useState(workout?.start_time?.slice(0, 5) ?? "05:30");
  const [endTime, setEndTime] = useState(workout?.end_time?.slice(0, 5) ?? "06:15");
  const [regionId, setRegionId] = useState(workout?.region_id ?? regions[0]?.id ?? "");
  const [locationName, setLocationName] = useState(workout?.location_name ?? "");
  const [address, setAddress] = useState(workout?.address ?? "");
  const [mapLink, setMapLink] = useState(workout?.map_link ?? "");
  const [isActive, setIsActive] = useState(workout?.is_active ?? true);

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeRegions = regions.filter((r) => r.is_active);

  const handleSave = async () => {
    if (!token || !aoName || !address || !regionId) return;
    setIsSaving(true);
    setError("");

    const body = {
      ao_name: aoName,
      workout_type: workoutType,
      day_of_week: dayOfWeek,
      start_time: startTime + ":00",
      end_time: endTime + ":00",
      region_id: regionId,
      location_name: locationName || null,
      address,
      map_link: mapLink || null,
      is_active: isActive,
    };

    try {
      const url = isEdit
        ? `/api/admin/workouts/${workout.id}`
        : "/api/admin/workouts";

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Error saving workout");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !workout) return;
    if (!window.confirm(`Delete "${workout.ao_name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/workouts/${workout.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Error deleting workout");
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm";
  const labelClass =
    "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#112240] rounded-lg border border-[#23334A] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#23334A] sticky top-0 bg-[#112240]">
          <h3 className="text-lg font-bold">
            {isEdit ? "Edit Workout" : "Add Workout"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* AO Name */}
          <div>
            <label className={labelClass}>AO Name</label>
            <input
              type="text"
              value={aoName}
              onChange={(e) => setAoName(e.target.value)}
              className={inputClass}
              placeholder="e.g. The Foundry"
            />
          </div>

          {/* Workout Type + Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Workout Type</label>
              <input
                type="text"
                list="workout-types"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                className={inputClass}
              />
              <datalist id="workout-types">
                {WORKOUT_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className={inputClass}
              >
                {DAY_NAMES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start/End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Region */}
          <div>
            <label className={labelClass}>Region</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className={inputClass}
            >
              {activeRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-[#4a5e73] mt-1">
              Manage regions in Admin &gt; Regions
            </div>
          </div>

          {/* Location Name */}
          <div>
            <label className={labelClass}>Location Name</label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Swift-Cantrell Park"
            />
          </div>

          {/* Address */}
          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
              placeholder="e.g. 3140 Old 41 Hwy NW, Kennesaw, GA 30144"
            />
          </div>

          {/* Map Link */}
          <div>
            <label className={labelClass}>
              Map Link <span className="font-normal normal-case text-gray-600">(optional)</span>
            </label>
            <input
              type="url"
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              className={inputClass}
              placeholder="https://maps.google.com/..."
            />
          </div>

          {/* Active Toggle */}
          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <div
              onClick={() => setIsActive(!isActive)}
              className={`w-10 h-[22px] rounded-full relative transition-colors cursor-pointer ${
                isActive ? "bg-[#4A76A8]" : "bg-[#23334A]"
              }`}
            >
              <div
                className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all ${
                  isActive ? "right-[2px]" : "left-[2px]"
                }`}
              />
            </div>
            <span className="text-sm text-gray-300">Active</span>
            <span className="text-xs text-[#4a5e73]">
              — inactive workouts are hidden from the public page
            </span>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-[#23334A]">
          {isEdit ? (
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded border border-red-800 text-red-400 text-sm hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!aoName || !address || !regionId || isSaving}
            >
              {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WorkoutGrid component**

Create `src/app/admin/workouts/WorkoutGrid.tsx`:

```typescript
"use client";

import { WorkoutBlock } from "./WorkoutBlock";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface WorkoutGridProps {
  workouts: WorkoutScheduleRow[];
  regions: Region[];
  selectedIds: Set<string>;
  regionFilter: string | null; // null = show all
  onSelectWorkout: (id: string) => void;
  onClickWorkout: (workout: WorkoutScheduleRow) => void;
  onAddToDay: (day: number) => void;
}

export function WorkoutGrid({
  workouts,
  regions,
  selectedIds,
  regionFilter,
  onSelectWorkout,
  onClickWorkout,
  onAddToDay,
}: WorkoutGridProps) {
  const regionMap = new Map(regions.map((r) => [r.id, r]));

  // Group workouts by day, sorted by start_time
  const byDay: Record<number, WorkoutScheduleRow[]> = {};
  for (let d = 1; d <= 7; d++) byDay[d] = [];

  const filtered = regionFilter
    ? workouts.filter((w) => w.region_id === regionFilter)
    : workouts;

  for (const w of filtered) {
    byDay[w.day_of_week]?.push(w);
  }

  // Sort each day by start_time
  for (const day of Object.values(byDay)) {
    day.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  return (
    <div className="grid grid-cols-7 min-h-[420px] border border-[#23334A] rounded-lg overflow-hidden">
      {/* Day headers */}
      {DAY_HEADERS.map((name, i) => (
        <div
          key={name}
          className="px-2 py-2 text-center font-bold text-xs text-[#8899aa] border-b-2 border-[#23334A] bg-[#112240]"
          style={{
            borderRight: i < 6 ? "1px solid #1a2d45" : undefined,
          }}
        >
          {name}
        </div>
      ))}

      {/* Day columns */}
      {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => (
        <div
          key={dayNum}
          className="flex flex-col gap-1 p-1.5"
          style={{
            borderRight: dayNum < 7 ? "1px solid #1a2d45" : undefined,
          }}
        >
          {byDay[dayNum].length === 0 && (
            <div className="text-[11px] text-[#4a5e73] text-center py-4">
              No workouts
            </div>
          )}
          {byDay[dayNum].map((workout) => (
            <WorkoutBlock
              key={workout.id}
              workout={workout}
              region={regionMap.get(workout.region_id)}
              isSelected={selectedIds.has(workout.id)}
              onSelect={onSelectWorkout}
              onClick={onClickWorkout}
            />
          ))}
          <button
            onClick={() => onAddToDay(dayNum)}
            className="mt-auto border border-dashed border-[#23334A] rounded p-1 text-center text-[#4a5e73] text-[11px] hover:border-[#4A76A8] hover:text-[#4A76A8] transition-colors"
          >
            + Add
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the workouts admin page**

Create `src/app/admin/workouts/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdminAuth } from "../layout";
import { Button } from "@/components/ui/Button";
import { WorkoutGrid } from "./WorkoutGrid";
import { WorkoutModal } from "./WorkoutModal";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

export default function WorkoutsAdminPage() {
  const { token } = useAdminAuth();

  const [workouts, setWorkouts] = useState<WorkoutScheduleRow[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  // Modal
  const [modalWorkout, setModalWorkout] = useState<WorkoutScheduleRow | null>(null);
  const [modalDefaultDay, setModalDefaultDay] = useState<number | undefined>();
  const [showModal, setShowModal] = useState(false);

  // Bulk
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkRegionId, setBulkRegionId] = useState<string>("");
  const [showBulkRegionPicker, setShowBulkRegionPicker] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [wRes, rRes] = await Promise.all([
        fetch("/api/admin/workouts", {
          headers: { "x-admin-token": token },
        }),
        fetch("/api/admin/regions", {
          headers: { "x-admin-token": token },
        }),
      ]);

      if (wRes.ok && rRes.ok) {
        const wData = await wRes.json();
        const rData = await rRes.json();
        setWorkouts(wData.workouts);
        setRegions(rData.regions);
      }
    } catch {
      setError("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSelectWorkout = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateModal = (day?: number) => {
    setModalWorkout(null);
    setModalDefaultDay(day);
    setShowModal(true);
  };

  const openEditModal = (workout: WorkoutScheduleRow) => {
    setModalWorkout(workout);
    setModalDefaultDay(undefined);
    setShowModal(true);
  };

  const handleBulkAction = async (action: string) => {
    if (!token || selectedIds.size === 0) return;
    setError("");
    setMessage("");
    setShowBulkMenu(false);

    if (action === "change_region") {
      setShowBulkRegionPicker(true);
      return;
    }

    if (action === "delete") {
      if (!window.confirm(`Delete ${selectedIds.size} workout(s)? This cannot be undone.`)) return;
    }

    try {
      const res = await fetch("/api/admin/workouts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          action,
          ids: Array.from(selectedIds),
          confirm: action === "delete" ? true : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`${data.affected} workout(s) updated.`);
        setSelectedIds(new Set());
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Bulk action failed");
      }
    } catch {
      setError("Error performing bulk action");
    }
  };

  const handleBulkChangeRegion = async () => {
    if (!token || !bulkRegionId) return;
    setError("");
    setMessage("");
    setShowBulkRegionPicker(false);

    try {
      const res = await fetch("/api/admin/workouts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          action: "change_region",
          ids: Array.from(selectedIds),
          region_id: bulkRegionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`${data.affected} workout(s) updated.`);
        setSelectedIds(new Set());
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Bulk action failed");
      }
    } catch {
      setError("Error performing bulk action");
    }
  };

  const activeRegions = regions.filter((r) => r.is_active);

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8899aa]">Filter:</span>
          <button
            onClick={() => setRegionFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              !regionFilter
                ? "bg-[#4A76A8] text-white"
                : "bg-[#23334a] text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          {activeRegions.map((r) => (
            <button
              key={r.id}
              onClick={() =>
                setRegionFilter(regionFilter === r.id ? null : r.id)
              }
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                regionFilter === r.id
                  ? "bg-[#4A76A8] text-white"
                  : "bg-[#23334a] text-gray-400 hover:text-white"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {message && <span className="text-green-400 text-sm">{message}</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}

          {selectedIds.size > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="bg-[#23334a] text-gray-300 border border-[#3a5e88] px-3 py-1.5 rounded text-xs hover:text-white transition-colors"
              >
                Bulk Actions ({selectedIds.size}) ▾
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#112240] border border-[#23334A] rounded shadow-xl z-10 min-w-[160px]">
                  <button
                    onClick={() => handleBulkAction("deactivate")}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#23334A] transition-colors"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction("change_region")}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#23334A] transition-colors"
                  >
                    Change Region
                  </button>
                  <button
                    onClick={() => handleBulkAction("delete")}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[#23334A] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 text-sm"
          >
            + Add Workout
          </Button>
        </div>
      </div>

      {/* Grid */}
      <WorkoutGrid
        workouts={workouts}
        regions={regions}
        selectedIds={selectedIds}
        regionFilter={regionFilter}
        onSelectWorkout={handleSelectWorkout}
        onClickWorkout={openEditModal}
        onAddToDay={(day) => openCreateModal(day)}
      />

      {/* Workout Modal */}
      {showModal && (
        <WorkoutModal
          workout={modalWorkout}
          regions={regions}
          defaultDay={modalDefaultDay}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}

      {/* Bulk Region Picker Modal */}
      {showBulkRegionPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#112240] p-6 rounded-lg border border-[#23334A] w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Change Region</h3>
            <p className="text-sm text-gray-400 mb-3">
              Move {selectedIds.size} workout(s) to:
            </p>
            <select
              value={bulkRegionId}
              onChange={(e) => setBulkRegionId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm mb-4"
            >
              <option value="">Select a region...</option>
              {activeRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowBulkRegionPicker(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleBulkChangeRegion}
                disabled={!bulkRegionId}
              >
                Move
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify workouts admin page works**

Run: `npm run dev`
Navigate to `/admin/workouts` — should display the calendar grid with all workouts.
Test: Click a workout block (opens edit modal), click "+ Add" on a day column, use region filter pills, select checkboxes and try bulk actions.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/workouts/
git commit -m "feat: add workouts admin page with calendar grid, modal, and bulk actions"
```

---

## Chunk 6: Public Page Updates

### Task 9: Update getWorkoutSchedule to use dynamic regions

**Files:**
- Modify: `src/lib/workouts/getWorkoutSchedule.ts`
- Modify: `src/app/workouts/page.tsx`
- Modify: `src/app/workouts/WorkoutSchedule.tsx`

- [ ] **Step 1: Rewrite getWorkoutSchedule with dynamic regions**

Replace contents of `src/lib/workouts/getWorkoutSchedule.ts`:

```typescript
import { supabase } from "@/lib/supabase";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

export interface RegionInfo {
  name: string;
  slug: string;
  is_primary: boolean;
  sort_order: number;
}

export interface RegionWorkouts {
  region: RegionInfo;
  workouts: WorkoutScheduleRow[];
}

export interface DaySchedule {
  regions: RegionWorkouts[];
}

export async function getWorkoutSchedule(): Promise<
  Record<number, DaySchedule>
> {
  // Fetch active regions
  const { data: regionsData } = await supabase
    .from("regions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const regions: Region[] = regionsData ?? [];

  // Fetch active workouts
  const { data: workoutsData } = await supabase
    .from("workout_schedule")
    .select("*")
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  const workouts: WorkoutScheduleRow[] = workoutsData ?? [];

  // Build region lookup
  const regionMap = new Map<string, Region>(
    regions.map((r) => [r.id, r])
  );

  // Group by day, then by region
  const schedule: Record<number, DaySchedule> = {};

  for (let d = 1; d <= 7; d++) {
    const dayWorkouts = workouts.filter((w) => w.day_of_week === d);
    const regionGroups: RegionWorkouts[] = [];

    for (const region of regions) {
      const rWorkouts = dayWorkouts.filter(
        (w) => w.region_id === region.id
      );
      if (rWorkouts.length > 0) {
        regionGroups.push({
          region: {
            name: region.name,
            slug: region.slug,
            is_primary: region.is_primary,
            sort_order: region.sort_order,
          },
          workouts: rWorkouts,
        });
      }
    }

    schedule[d] = { regions: regionGroups };
  }

  return schedule;
}
```

- [ ] **Step 2: Update workouts page.tsx server component**

The server component at `src/app/workouts/page.tsx` should need minimal changes — it already converts the result to a plain object. Update the import if needed to match the new `DaySchedule` type. The key change is that `getWorkoutSchedule` now returns `Record<number, DaySchedule>` directly instead of a Map.

- [ ] **Step 3: Update WorkoutSchedule.tsx to render dynamic regions**

Rewrite `src/app/workouts/WorkoutSchedule.tsx` to use the new `DaySchedule` with dynamic `regions` array:

- Replace the hard-coded `REGIONS` array with dynamic iteration over `schedule[dayNum].regions`
- Primary regions render with their name as the section heading (same as before)
- Non-primary regions are collected into an "Other Nearby" group, with each workout card showing its region name as a badge

Key changes to `RegionSection`:
- Accept `RegionWorkouts[]` for the "Other Nearby" group
- For primary: render section heading with region name
- For non-primary: render under "Other Nearby" heading, show region badge on each card

Key changes to `DayCard`:
- Split regions into primary and non-primary
- Render primary regions as individual sections
- Collect non-primary regions into one "Other Nearby" section

Key changes to `WorkoutCard`:
- Accept optional `regionName` prop for non-primary regions
- Display as a badge when provided

- [ ] **Step 4: Verify public workouts page**

Run: `npm run dev`
Navigate to `http://localhost:3000/workouts` — should display the same layout as before but now driven by dynamic regions. Primary regions show as section headers, non-primary grouped under "Other Nearby".

- [ ] **Step 5: Commit**

```bash
git add src/lib/workouts/getWorkoutSchedule.ts src/app/workouts/page.tsx src/app/workouts/WorkoutSchedule.tsx
git commit -m "feat: update public workouts page for dynamic regions"
```

---

## Chunk 7: E2E Tests

### Task 10: Write Playwright E2E tests

**Files:**
- Create: `tests/admin-workouts.spec.ts`

- [ ] **Step 1: Write E2E tests for admin workout management**

Create `tests/admin-workouts.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

// These tests require ADMIN_DASHBOARD_PASSWORD to be set in .env.local
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD || "test-password";

test.describe("Admin Workout Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/admin");
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    // Wait for the admin page to load
    await page.waitForURL(/\/admin\/workouts/);
  });

  test("displays sidebar navigation", async ({ page }) => {
    await expect(page.getByText("F3 Marietta Admin")).toBeVisible();
    await expect(page.getByRole("link", { name: "Workouts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Regions" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Knowledge Base" })
    ).toBeVisible();
  });

  test("displays workout calendar grid with day columns", async ({ page }) => {
    await expect(page.getByText("MON")).toBeVisible();
    await expect(page.getByText("TUE")).toBeVisible();
    await expect(page.getByText("WED")).toBeVisible();
    await expect(page.getByText("THU")).toBeVisible();
    await expect(page.getByText("FRI")).toBeVisible();
    await expect(page.getByText("SAT")).toBeVisible();
    await expect(page.getByText("SUN")).toBeVisible();
  });

  test("opens create modal when clicking Add Workout", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Workout" }).click();
    await expect(page.getByText("Add Workout")).toBeVisible();
    await expect(page.getByLabel("AO Name")).toBeVisible();
    await expect(page.getByLabel("Workout Type")).toBeVisible();
    // Close modal
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("opens edit modal when clicking a workout block", async ({ page }) => {
    // Click the first workout block in the grid
    const firstBlock = page.locator('[class*="bg-\\[\\#112240\\]"]').first();
    await firstBlock.click();
    await expect(page.getByText("Edit Workout")).toBeVisible();
  });

  test("navigates to regions page", async ({ page }) => {
    await page.getByRole("link", { name: "Regions" }).click();
    await page.waitForURL(/\/admin\/regions/);
    await expect(page.getByText("Regions")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Region/ })).toBeVisible();
  });

  test("region filter pills filter workouts", async ({ page }) => {
    // Click a region filter pill
    const allButton = page.getByRole("button", { name: "All" });
    await expect(allButton).toBeVisible();
    // Click "All" to verify it's the default active state
    await allButton.click();
  });
});

test.describe("Admin Regions Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/regions");
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForURL(/\/admin/);
    await page.getByRole("link", { name: "Regions" }).click();
  });

  test("displays regions table", async ({ page }) => {
    await expect(page.getByText("Marietta")).toBeVisible();
  });

  test("opens add region modal", async ({ page }) => {
    await page.getByRole("button", { name: /Add Region/ }).click();
    await expect(page.getByText("Add Region")).toBeVisible();
  });
});

test.describe("Public Workouts Page", () => {
  test("renders workout schedule with dynamic regions", async ({ page }) => {
    await page.goto("/workouts");
    await expect(page.getByText("Monday")).toBeVisible();
    // Should show at least one workout
    await expect(page.locator("text=AM").first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx playwright test tests/admin-workouts.spec.ts --headed`
Expected: Tests should pass (adjust selectors based on actual rendered output if needed).

- [ ] **Step 3: Commit**

```bash
git add tests/admin-workouts.spec.ts
git commit -m "test: add E2E tests for admin workout and region management"
```

---

## Chunk 8: Final Verification

### Task 11: Build check and cleanup

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 3: Run full E2E suite**

Run: `npm run test:e2e`
Expected: All tests pass, including new admin tests and existing tests.

- [ ] **Step 4: Manual smoke test**

1. Open `/admin` — login works, sidebar shows all 3 links
2. `/admin/workouts` — calendar grid shows all workouts, region filters work
3. Click a workout → edit modal works, save updates the grid
4. Click "+ Add" on a day → create modal pre-fills day, save adds to grid
5. Select multiple checkboxes → bulk deactivate/delete/change region work
6. `/admin/regions` — table shows regions, add/edit/delete work
7. `/admin/kb` — existing KB editor still works within new layout
8. `/workouts` — public page renders correctly with dynamic regions

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for admin workout manager"
```
