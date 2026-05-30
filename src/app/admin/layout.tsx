import Link from "next/link";
import type { ReactNode } from "react";
import { AdminAuthProvider } from "./AdminAuthContext";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const ADMIN_NAV = [
  { label: "Dashboard",  href: "/admin/analytics" },
  { label: "Workouts",   href: "/admin/workouts" },
  { label: "Regions",    href: "/admin/regions" },
  { label: "AO Channels", href: "/admin/ao-channels" },
  { label: "Drafts",     href: "/admin/drafts" },
  { label: "Newsletter", href: "/admin/newsletter" },
  { label: "KB",         href: "/admin/kb" },
  { label: "Team",       href: "/admin/team" },
  { label: "Profile",    href: "/admin/profile" },
];

/** Shared nav link list — rendered inline on desktop and as a scrollable row
 *  on mobile so every admin section stays reachable on a phone. */
function AdminNavLinks({ className }: { className?: string }) {
  return (
    <nav className={className}>
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="px-3 py-1.5 text-bone/75 hover:text-steel transition-colors whitespace-nowrap shrink-0"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-bone">
        <div className="bg-ink text-bone">
          <div className="max-w-[1320px] mx-auto px-7 py-3 flex items-center justify-between font-mono text-[11px] tracking-[.15em] uppercase">
            <div className="flex items-center gap-3">
              <span className="text-steel">// ADMIN</span>
              <span className="opacity-60 hidden sm:inline">F3 Marietta · Region Ops</span>
            </div>
            {/* Desktop: inline nav */}
            <AdminNavLinks className="hidden md:flex items-center gap-1" />
          </div>

          {/* Mobile: horizontally scrollable nav so Workouts / AOs / Regions /
              etc. are reachable on a phone (desktop nav above is hidden < md). */}
          <AdminNavLinks className="md:hidden flex items-center gap-1 overflow-x-auto px-7 pb-2 border-t border-bone/10 font-mono text-[11px] tracking-[.15em] uppercase" />
        </div>

        <div className="max-w-[1320px] mx-auto px-7 py-3 border-b border-line-soft">
          <MonoTag>// Home / Admin</MonoTag>
        </div>

        <main>{children}</main>
      </div>
    </AdminAuthProvider>
  );
}
