import Link from "next/link";

type Tab = {
  label: string;
  /** path WITHOUT querystring — filter suffix is appended */
  path: string;
};

type Props = {
  /** which tab is active — must match a tab's `path` exactly */
  current: string;
  /** appended verbatim to each tab href (preserves range/compare/ao filters) */
  filterSuffix?: string;
  /** "customer" → /stats/* tabs · "admin" → /admin/analytics/* tabs */
  scope?: "customer" | "admin";
};

const CUSTOMER_TABS: Tab[] = [
  { label: "Overview", path: "/stats" },
  { label: "FNGs", path: "/stats/fngs" },
  { label: "Qs", path: "/stats/qs" },
];

const ADMIN_TABS: Tab[] = [
  { label: "Overview", path: "/admin/analytics" },
  { label: "FNGs", path: "/admin/analytics/fngs" },
  { label: "Qs", path: "/admin/analytics/qs" },
];

export function StatsNav({ current, filterSuffix = "", scope = "customer" }: Props) {
  const tabs = scope === "admin" ? ADMIN_TABS : CUSTOMER_TABS;
  return (
    <nav
      aria-label="BI section navigation"
      className="flex flex-wrap items-center gap-2 mb-6 -mt-4"
    >
      {tabs.map((t) => {
        const isActive = t.path === current;
        return (
          <Link
            key={t.path}
            href={`${t.path}${filterSuffix}`}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={
              "inline-flex items-center px-4 py-2 border font-mono text-[11px] tracking-[.15em] uppercase transition-colors " +
              (isActive
                ? "bg-ink text-bone border-ink"
                : "bg-transparent border-black/20 text-ink hover:border-ink hover:bg-black/5")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
