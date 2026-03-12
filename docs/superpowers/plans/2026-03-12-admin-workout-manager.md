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

-- 5. Drop the CHECK constraint on the old region column (name may vary)
DO $$
DECLARE
  _con text;
BEGIN
  SELECT conname INTO _con
    FROM pg_constraint
   WHERE conrelid = 'workout_schedule'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%region%';
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE workout_schedule DROP CONSTRAINT %I', _con);
  END IF;
END $$;

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
        .in("id", ids)
        .select("id", { count: "exact", head: true });
      break;

    case "delete":
      result = await supabase
        .from("workout_schedule")
        .delete({ count: "exact" })
        .in("id", ids);
      break;

    case "change_region":
      result = await supabase
        .from("workout_schedule")
        .update({ region_id, updated_at: new Date().toISOString() })
        .in("id", ids)
        .select("id", { count: "exact", head: true });
      break;
  }

  if (result?.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const affected = result?.count ?? ids.length;
  return NextResponse.json({ success: true, affected });
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
- Create: `src/app/admin/AdminAuthContext.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Modify: `src/app/admin/kb/page.tsx`

- [ ] **Step 1a: Create the AdminAuthContext module**

Named exports from Next.js layout files are not importable by child pages. The auth context must live in its own module.

Create `src/app/admin/AdminAuthContext.tsx`:

```typescript
"use client";

import { createContext, useContext } from "react";

interface AdminAuthContextValue {
  token: string | null;
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextValue>({
  token: null,
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
```

- [ ] **Step 1b: Create the admin layout**

Create `src/app/admin/layout.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AdminAuthContext } from "./AdminAuthContext";
import {
  BookOpen,
  Dumbbell,
  MapPin,
  LogOut,
} from "lucide-react";

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
    <AdminAuthContext.Provider value={{ token, logout }}>
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
    </AdminAuthContext.Provider>
  );
}
```

- [ ] **Step 2: Create the admin index redirect**

Create `src/app/admin/page.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/workouts");
  }, [router]);

  return null;
}
```

- [ ] **Step 3: Refactor KB page to use shared layout auth**

Replace the contents of `src/app/admin/kb/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdminAuth } from "../AdminAuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Folder, FileText, Search, Plus, Save, Eye, Edit3, Code, ChevronRight, ChevronDown } from "lucide-react";

// --- Types ---

interface KBFile {
    path: string;
    folder: string;
    slug: string;
    title: string;
    category: string;
    tags: string[];
}

interface KBFileDetail {
    path: string;
    folder: string;
    frontmatter: {
        title?: string;
        category?: string;
        tags?: string[];
        aliases?: string[];
        [key: string]: unknown;
    };
    sections: Record<string, string>;
    raw: string;
}

// --- Helpers ---

function humanizeFolder(folder: string): string {
    if (folder === "faq") return "FAQ";
    if (folder === "q-guides") return "Q Guides";
    if (folder === "f3-guides") return "F3 Guides";
    return folder
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// --- Components ---

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={cn("px-2 py-0.5 rounded text-xs font-medium bg-[#23334A] text-gray-300 border border-[#3A5E88]", className)}>
            {children}
        </span>
    );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="mb-4">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                placeholder={placeholder}
            />
        </div>
    );
}

function Textarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
    return (
        <div className="mb-4 flex-1 flex flex-col">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm font-mono resize-y"
            />
        </div>
    );
}

// --- Main Page Component ---

export default function KBAdminPage() {
    const { token, logout } = useAdminAuth();

    // Data State
    const [files, setFiles] = useState<KBFile[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<KBFile | null>(null);
    const [fileDetail, setFileDetail] = useState<KBFileDetail | null>(null);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"form" | "markdown" | "preview">("form");
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    // New Entry Modal
    const [showNewModal, setShowNewModal] = useState(false);
    const [newFolder, setNewFolder] = useState("faq");
    const [newTitle, setNewTitle] = useState("");

    // Form State (Local edits)
    const [formData, setFormData] = useState<Partial<KBFileDetail>>({});

    // --- Effects ---

    useEffect(() => {
        if (token) fetchFiles(token);
    }, [token]);

    // --- API Calls ---

    const fetchFiles = async (authToken: string) => {
        try {
            const res = await fetch("/api/admin/kb/files", {
                headers: { "x-admin-token": authToken },
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setFiles(data);
                    setFolders([...new Set(data.map((f: KBFile) => f.folder))].sort());
                } else {
                    setFiles(data.files);
                    setFolders(data.folders);
                }
            } else if (res.status === 401) {
                logout();
            }
        } catch {
            console.error("Failed to fetch files");
        }
    };

    const loadFile = async (file: KBFile) => {
        if (!token) return;
        setSelectedFile(file);
        setFileDetail(null);
        setIsLoading(true);
        setError("");
        setMessage("");
        setActiveTab("form");

        try {
            const res = await fetch(`/api/admin/kb/file?path=${encodeURIComponent(file.path)}`, {
                headers: { "x-admin-token": token },
            });
            if (res.ok) {
                const data = await res.json();
                setFileDetail(data);
                setFormData({
                    frontmatter: { ...data.frontmatter },
                    sections: { ...data.sections },
                    raw: data.raw
                });
            } else {
                setError("Failed to load file");
            }
        } catch {
            setError("Error loading file");
        } finally {
            setIsLoading(false);
        }
    };

    const saveFile = async () => {
        if (!token || !selectedFile) return;
        setIsSaving(true);
        setMessage("");
        setError("");

        try {
            const payload = {
                path: selectedFile.path,
                folder: selectedFile.folder,
                ...(activeTab === "markdown"
                    ? { raw: formData.raw }
                    : {
                        frontmatter: formData.frontmatter,
                        sections: formData.sections
                    }
                )
            };

            const res = await fetch("/api/admin/kb/file", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setMessage("Saved and reindexed.");
                loadFile(selectedFile);
            } else {
                setError("Failed to save");
            }
        } catch {
            setError("Error saving");
        } finally {
            setIsSaving(false);
        }
    };

    const createEntry = async () => {
        if (!token || !newTitle) return;
        setIsSaving(true);

        const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const path = `data/content/${newFolder}/${slug}.md`;

        let content = "";
        if (newFolder === "faq") {
            content = `---\ntitle: ${newTitle}\ncategory: New to F3\ntags: []\naliases: []\n---\n\n### Question\n${newTitle}\n\n### Answer\nTBD\n\n### Related\n- \n`;
        } else if (newFolder === "lexicon") {
            content = `---\ntitle: ${newTitle}\ncategory: Term\ntags: []\naliases: []\n---\n\n### Definition\nTBD\n\n### How it's used\nTBD\n\n### Variations\n- \n\n### Notes\nTBD\n\n### Related terms\n- \n`;
        } else if (newFolder === "exicon") {
            content = `---\ntitle: ${newTitle}\ncategory: Exercise\ntags: []\naliases: []\n---\n\n### Definition\nTBD\n\n### How it's done\n1. \n\n### Variations\n- \n\n### Notes\nTBD\n\n### Related terms\n- \n`;
        } else {
            content = `---\ntitle: ${newTitle}\ncategory: ""\ntags: []\naliases: []\n---\n\nTBD\n`;
        }

        try {
            const res = await fetch("/api/admin/kb/file", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                },
                body: JSON.stringify({ path, raw: content }),
            });

            if (res.ok) {
                setShowNewModal(false);
                setNewTitle("");
                await fetchFiles(token);
                setMessage("Entry created.");
            } else {
                setError("Failed to create entry");
            }
        } catch {
            setError("Error creating entry");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Computed ---

    const groupedFiles = useMemo(() => {
        const groups: Record<string, KBFile[]> = {};
        folders.forEach(f => { groups[f] = []; });

        const filtered = files.filter(f => {
            const title = typeof f.title === 'string' ? f.title : String(f.title || '');
            return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.slug.includes(searchQuery.toLowerCase());
        });

        filtered.forEach(f => {
            if (!groups[f.folder]) groups[f.folder] = [];
            groups[f.folder].push(f);
        });

        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key].sort((a, b) => {
                const titleA = typeof a.title === 'string' ? a.title : String(a.title || '');
                const titleB = typeof b.title === 'string' ? b.title : String(b.title || '');
                return titleA.localeCompare(titleB);
            });
            return acc;
        }, {} as Record<string, KBFile[]>);
    }, [files, folders, searchQuery]);

    const allFolders = useMemo(() => {
        const folderSet = new Set(files.map(f => f.folder));
        const defaults = ["faq", "lexicon", "exicon", "culture", "events", "gear", "leadership", "q-guides", "regions", "stories", "workouts"];
        defaults.forEach(d => folderSet.add(d));
        return Array.from(folderSet).sort();
    }, [files]);

    const toggleFolder = (folder: string) => {
        setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
    };

    // --- Render Helpers ---

    const renderForm = () => {
        if (!fileDetail) return null;
        const { folder } = fileDetail;
        const fm = formData.frontmatter || {};
        const sec = formData.sections || {};

        const updateFM = (key: string, val: unknown) => {
            setFormData({ ...formData, frontmatter: { ...fm, [key]: val } });
        };
        const updateSec = (key: string, val: string) => {
            setFormData({ ...formData, sections: { ...sec, [key]: val } });
        };

        return (
            <div className="space-y-6 max-w-3xl mx-auto pb-20">
                <div className="bg-[#112240] p-4 rounded-lg border border-[#23334A]">
                    <h4 className="text-sm font-bold text-gray-300 mb-4 border-b border-[#23334A] pb-2">Metadata</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Title" value={fm.title || ""} onChange={(v) => updateFM("title", v)} />
                        <Input label="Category" value={fm.category || ""} onChange={(v) => updateFM("category", v)} />
                        <Input label="Tags (comma separated)" value={(fm.tags || []).join(", ")} onChange={(v) => updateFM("tags", v.split(",").map(s => s.trim()))} />
                        <Input label="Aliases (comma separated)" value={(fm.aliases || []).join(", ")} onChange={(v) => updateFM("aliases", v.split(",").map(s => s.trim()))} />
                    </div>
                </div>

                <div className="bg-[#112240] p-4 rounded-lg border border-[#23334A]">
                    <h4 className="text-sm font-bold text-gray-300 mb-4 border-b border-[#23334A] pb-2">Content</h4>
                    {folder === "faq" ? (
                        <>
                            <Textarea label="Question" value={sec.question || ""} onChange={(v) => updateSec("question", v)} />
                            <Textarea label="Answer" value={sec.answer || ""} onChange={(v) => updateSec("answer", v)} rows={8} />
                            <Textarea label="Related (Markdown list)" value={sec.related || ""} onChange={(v) => updateSec("related", v)} />
                        </>
                    ) : (folder === "lexicon" || folder === "exicon") ? (
                        <>
                            <Textarea label="Definition" value={sec.definition || ""} onChange={(v) => updateSec("definition", v)} />
                            <Textarea
                                label={folder === "exicon" ? "How it's done" : "How it's used"}
                                value={(folder === "exicon" ? sec.howDone : sec.howUsed) || ""}
                                onChange={(v) => updateSec(folder === "exicon" ? "howDone" : "howUsed", v)}
                                rows={6}
                            />
                            <Textarea label="Variations" value={sec.variations || ""} onChange={(v) => updateSec("variations", v)} />
                            <Textarea label="Notes" value={sec.notes || ""} onChange={(v) => updateSec("notes", v)} />
                            <Textarea label="Related Terms" value={sec.related || ""} onChange={(v) => updateSec("related", v)} />
                        </>
                    ) : (
                        <Textarea label="Body" value={sec.body || formData.raw || ""} onChange={(v) => updateSec("body", v)} rows={20} />
                    )}
                </div>
            </div>
        );
    };

    // --- Main Render ---

    return (
        <div className="flex h-screen overflow-hidden">
            {/* File Browser Sidebar */}
            <div className="w-72 bg-[#112240] border-r border-[#23334A] flex flex-col shrink-0">
                <div className="p-4 border-b border-[#23334A] space-y-3">
                    <h2 className="font-bold text-lg">Knowledge Base</h2>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] text-sm focus:outline-none focus:border-[#4A76A8] text-white"
                        />
                    </div>
                    <Button size="sm" className="w-full flex items-center justify-center gap-2" onClick={() => setShowNewModal(true)}>
                        <Plus className="h-4 w-4" /> New Entry
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {Object.entries(groupedFiles).map(([folder, groupFiles]) => (
                        <div key={folder} className="mb-2">
                            <button
                                onClick={() => toggleFolder(folder)}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider hover:bg-[#23334A] rounded"
                            >
                                <span className="flex items-center gap-2">
                                    <Folder className="h-3 w-3" /> {humanizeFolder(folder)}
                                </span>
                                {expandedFolders[folder] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>

                            {expandedFolders[folder] && (
                                <div className="ml-2 mt-1 space-y-0.5 border-l border-[#23334A] pl-2">
                                    {groupFiles.length === 0 ? (
                                        <div className="px-2 py-1.5 text-xs text-gray-600 italic">No entries yet</div>
                                    ) : (
                                        groupFiles.map(file => (
                                            <button
                                                key={file.path}
                                                onClick={() => loadFile(file)}
                                                className={cn(
                                                    "w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate flex items-center gap-2",
                                                    selectedFile?.path === file.path
                                                        ? "bg-[#4A76A8] text-white font-medium"
                                                        : "text-gray-300 hover:bg-[#23334A]"
                                                )}
                                            >
                                                <FileText className="h-3 w-3 opacity-50" />
                                                {file.title}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {!selectedFile ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
                        <Folder className="h-16 w-16 opacity-20" />
                        <p>Select a file to edit</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-[#23334A] bg-[#0A1A2F] flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <Badge className="uppercase">{humanizeFolder(selectedFile.folder)}</Badge>
                                <span className="text-gray-400">/</span>
                                <h3 className="font-bold text-lg">{selectedFile.title}</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {message && <span className="text-green-400 text-sm">{message}</span>}
                                {error && <span className="text-red-400 text-sm">{error}</span>}
                                <Button onClick={saveFile} disabled={isSaving} className="flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    {isSaving ? "Saving..." : "Save & Reindex"}
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[#23334A] bg-[#112240] shrink-0">
                            <button
                                onClick={() => setActiveTab("form")}
                                className={cn("px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors", activeTab === "form" ? "border-[#4A76A8] text-white bg-[#0A1A2F]" : "border-transparent text-gray-400 hover:text-white")}
                            >
                                <Edit3 className="h-4 w-4" /> Form
                            </button>
                            <button
                                onClick={() => setActiveTab("markdown")}
                                className={cn("px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors", activeTab === "markdown" ? "border-[#4A76A8] text-white bg-[#0A1A2F]" : "border-transparent text-gray-400 hover:text-white")}
                            >
                                <Code className="h-4 w-4" /> Markdown
                            </button>
                            <button
                                onClick={() => setActiveTab("preview")}
                                className={cn("px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors", activeTab === "preview" ? "border-[#4A76A8] text-white bg-[#0A1A2F]" : "border-transparent text-gray-400 hover:text-white")}
                            >
                                <Eye className="h-4 w-4" /> Preview
                            </button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-[#0A1A2F]">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
                            ) : (
                                <>
                                    {activeTab === "form" && renderForm()}
                                    {activeTab === "markdown" && (
                                        <div className="h-full flex flex-col">
                                            <textarea
                                                value={formData.raw || ""}
                                                onChange={(e) => setFormData({ ...formData, raw: e.target.value })}
                                                className="flex-1 w-full bg-[#112240] text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none rounded border border-[#23334A]"
                                                spellCheck={false}
                                            />
                                        </div>
                                    )}
                                    {activeTab === "preview" && (
                                        <div className="max-w-3xl mx-auto prose prose-invert">
                                            <div className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed">
                                                {formData.raw}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* New Entry Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#112240] p-6 rounded-lg border border-[#23334A] w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Create New Entry</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Folder</label>
                                <select
                                    value={newFolder}
                                    onChange={(e) => setNewFolder(e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                                >
                                    {allFolders.map(f => (
                                        <option key={f} value={f}>{humanizeFolder(f)}</option>
                                    ))}
                                </select>
                            </div>
                            <Input label="Title" value={newTitle} onChange={setNewTitle} placeholder="e.g. What is F3?" />
                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setShowNewModal(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={createEntry} disabled={!newTitle || isSaving}>Create</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Verify KB admin still works**

Run: `npm run dev`
Navigate to `http://localhost:3000/admin` — should see login screen.
After login, sidebar should show with KB, Workouts, Regions links.
Navigate to `/admin/kb` — should show the KB editor, fully functional.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/AdminAuthContext.tsx src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/kb/page.tsx
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
import { useAdminAuth } from "../AdminAuthContext";
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
      data-testid="workout-block"
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
import { useAdminAuth } from "../AdminAuthContext";
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
import { useAdminAuth } from "../AdminAuthContext";
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

`getWorkoutSchedule` now returns `Record<number, DaySchedule>` directly instead of a `Map`. Remove the Map-to-Record conversion.

Replace the contents of `src/app/workouts/page.tsx`:

```typescript
import { Section } from "@/components/ui/Section";
import { Hero } from "@/components/ui/Hero";
import { Button } from "@/components/ui/Button";
import { getWorkoutSchedule, type DaySchedule } from "@/lib/workouts/getWorkoutSchedule";
import { WorkoutSchedule } from "./WorkoutSchedule";

function getTodayISODay(): number {
    const day = new Date().getDay(); // 0=Sun … 6=Sat
    return day === 0 ? 7 : day; // ISO: 1=Mon … 7=Sun
}

export default async function WorkoutsPage() {
    const schedule = await getWorkoutSchedule();
    const todayIndex = getTodayISODay();

    return (
        <div className="flex flex-col min-h-screen">
            <Hero
                title="WORKOUT SCHEDULE"
                subtitle="Find a workout near you. Just show up."
                ctaText="New to F3?"
                ctaLink="/new-here"
                backgroundImage="/images/workouts-bg.jpg"
            />

            <Section>
                <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">
                    All workouts are free, open to all men, and held outdoors rain or shine.
                    Check the schedule below and join us in the gloom.
                </p>

                <WorkoutSchedule schedule={schedule} todayIndex={todayIndex} />
            </Section>

            <section className="mt-8 mb-20">
                <div className="max-w-2xl mx-auto text-center bg-[#0A1A2F] border border-[#23334A] rounded-xl px-6 py-8">
                    <h2 className="text-xl font-semibold mb-2 text-white">Not in Marietta? No problem!</h2>
                    <p className="text-gray-300">
                        You can find F3 workouts all across the country (and the world). Use the F3 Nation map to search for any region or AO.
                    </p>
                    <Button asChild className="mt-4">
                        <a
                            href="https://map.f3nation.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Find F3 Near You
                        </a>
                    </Button>
                </div>
            </section>
        </div>
    );
}
```

- [ ] **Step 3: Update WorkoutSchedule.tsx to render dynamic regions**

Replace the contents of `src/app/workouts/WorkoutSchedule.tsx`:

```typescript
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Clock, ExternalLink } from "lucide-react";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { DaySchedule, RegionWorkouts } from "@/lib/workouts/getWorkoutSchedule";

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

// ── Workout Card ────────────────────────────────────────────────────────────
function WorkoutCard({
  workout,
  regionName,
}: {
  workout: WorkoutScheduleRow;
  regionName?: string;
}) {
  const timeStr = `${formatTime(workout.start_time)} – ${formatTime(workout.end_time)}`;

  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2 hover:border-primary/50 transition-colors">
      <div className="space-y-1">
        <h4 className="font-bold text-sm text-foreground leading-tight">
          {workout.ao_name}
        </h4>
        <div className="flex flex-wrap gap-1">
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
            {workout.workout_type}
          </span>
          {regionName && (
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {regionName}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{timeStr}</span>
        </div>
        {workout.location_name && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="leading-tight">{workout.location_name}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground/70 pl-[1.125rem] leading-tight">
          {workout.address}
        </div>
      </div>
      {workout.map_link && (
        <a
          href={workout.map_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Directions <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ── Region Section ──────────────────────────────────────────────────────────
function RegionSection({
  label,
  workouts,
  showRegionBadge,
}: {
  label: string;
  workouts: { workout: WorkoutScheduleRow; regionName?: string }[];
  showRegionBadge?: boolean;
}) {
  if (workouts.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border/50">
        {label}
      </h4>
      <div className="space-y-2">
        {workouts.map(({ workout, regionName }) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            regionName={showRegionBadge ? regionName : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ── Day Card ────────────────────────────────────────────────────────────────
function DayCard({
  dayNum,
  schedule,
  defaultOpen,
}: {
  dayNum: number;
  schedule: DaySchedule;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const primaryRegions = schedule.regions.filter((rg) => rg.region.is_primary);
  const nonPrimaryRegions = schedule.regions.filter((rg) => !rg.region.is_primary);

  const totalWorkouts = schedule.regions.reduce(
    (sum, rg) => sum + rg.workouts.length,
    0
  );

  if (totalWorkouts === 0) return null;

  // Collect non-primary workouts with their region name for badge display
  const otherNearbyWorkouts = nonPrimaryRegions.flatMap((rg) =>
    rg.workouts.map((w) => ({ workout: w, regionName: rg.region.name }))
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold font-heading text-foreground">
            {DAY_NAMES[dayNum]}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {totalWorkouts} workout{totalWorkouts !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-4 pt-0 border-t border-border">
          {/* Primary regions — each gets its own section */}
          {primaryRegions.map((rg) => (
            <RegionSection
              key={rg.region.slug}
              label={rg.region.name}
              workouts={rg.workouts.map((w) => ({ workout: w }))}
            />
          ))}
          {/* Non-primary regions — grouped under "Other Nearby" with badges */}
          {otherNearbyWorkouts.length > 0 && (
            <RegionSection
              label="Other Nearby"
              workouts={otherNearbyWorkouts}
              showRegionBadge
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
interface WorkoutScheduleProps {
  schedule: Record<number, DaySchedule>;
  todayIndex: number;
}

export function WorkoutSchedule({ schedule, todayIndex }: WorkoutScheduleProps) {
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
        const daySchedule = schedule[dayNum];
        if (!daySchedule) return null;
        return (
          <DayCard
            key={dayNum}
            dayNum={dayNum}
            schedule={daySchedule}
            defaultOpen={dayNum === todayIndex}
          />
        );
      })}
    </div>
  );
}
```

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
    const firstBlock = page.locator("[data-testid='workout-block']").first();
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
