import Link from "next/link";
import type { ReactNode } from "react";
import { AdminAuthProvider } from "./AdminAuthContext";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const ADMIN_NAV = [
  { label: "Dashboard",  href: "/admin" },
  { label: "Workouts",   href: "/admin/workouts" },
  { label: "Regions",    href: "/admin/regions" },
  { label: "Drafts",     href: "/admin/drafts" },
  { label: "Newsletter", href: "/admin/newsletter" },
  { label: "KB",         href: "/admin/kb" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-bone">
        <div className="bg-ink text-bone">
          <div className="max-w-[1320px] mx-auto px-7 py-3 flex items-center justify-between font-mono text-[11px] tracking-[.15em] uppercase">
            <div className="flex items-center gap-3">
              <span className="text-steel">// ADMIN</span>
              <span className="opacity-60">F3 Marietta · Region Ops</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-bone/75 hover:text-steel transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="max-w-[1320px] mx-auto px-7 py-3 border-b border-line-soft">
          <MonoTag>// Home / Admin</MonoTag>
        </div>

        <main>{children}</main>
      </div>
    </AdminAuthProvider>
  );
}
