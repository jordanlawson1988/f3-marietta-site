import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { BackblastListItem } from "@/components/ui/BackblastListItem";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";
import { BackblastSearch } from "./BackblastSearch";
import { getBackblastsPaginated, getAOList } from "@/lib/backblast/getBackblastsPaginated";
import { getBackblastImage } from "@/lib/backblast/getBackblastImage";

export const metadata: Metadata = {
  title: "Backblasts",
  description: "Reports from the gloom. Every workout leaves a record.",
};

type SP = Promise<{ page?: string; ao?: string; search?: string }>;

export default async function BackblastsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const ao = sp.ao ?? undefined;
  const search = sp.search ?? undefined;

  const [{ rows, total, totalPages, pageSize }, aos] = await Promise.all([
    getBackblastsPaginated({ page, pageSize: 12, ao, search }),
    getAOList(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="§ Field Reports"
        variant="ink"
        title={<>From the<br />Gloom.</>}
        kicker={<>Every post produces a backblast. {total} reports on record.</>}
        meter={{ left: `Records · ${total}`, right: "Source · Slack + Slackblast Bot" }}
        backgroundImage={getBackblastImage(rows[0]?.id, rows[0]?.image_url)}
      />

      <section className="bg-bone py-14">
        <div className="max-w-[1320px] mx-auto px-7">
          {/* Search */}
          <div className="mb-8 max-w-md">
            <BackblastSearch />
          </div>

          {/* AO filter pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <MonoTag className="mr-3">// Filter by AO</MonoTag>
            <Link
              href={`/backblasts${search ? `?search=${encodeURIComponent(search)}` : ""}`}
              className={`px-4 py-2 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
                !ao ? "bg-ink text-bone border-ink" : "border-line-soft text-ink hover:border-ink"
              }`}
            >
              All
            </Link>
            {aos.map((name) => (
              <Link
                key={name}
                href={`/backblasts?ao=${encodeURIComponent(name)}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                className={`px-4 py-2 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
                  ao === name ? "bg-ink text-bone border-ink" : "border-line-soft text-ink hover:border-ink"
                }`}
              >
                {name}
              </Link>
            ))}
          </div>

          {/* Result count */}
          <p className="font-mono text-[11px] tracking-[.1em] uppercase text-muted mb-10">
            {total} report{total !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
            {ao ? ` at ${ao}` : ""}
          </p>

          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted font-mono text-[12px] tracking-[.15em] uppercase">
                No backblasts found{search ? ` for "${search}"` : ""}{ao ? ` at ${ao}` : ""}.
              </p>
              {(search || ao) && (
                <Link
                  href="/backblasts"
                  className="mt-4 inline-block font-mono text-[11px] tracking-[.1em] uppercase text-ink underline underline-offset-4"
                >
                  Clear filters
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {rows.map((item, i) => (
                <ScrollReveal key={item.id} delayMs={Math.min(i, 6) * 40}>
                  <BackblastListItem item={item} variant="expanded" />
                </ScrollReveal>
              ))}
            </div>
          )}

          <nav className="mt-12 flex items-center justify-between font-mono text-[11px] tracking-[.15em] uppercase text-muted">
            <span>{`Page ${page} of ${Math.max(totalPages, 1)} · ${pageSize} per page`}</span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link href={`/backblasts?${new URLSearchParams({ ...(ao ? { ao } : {}), ...(search ? { search } : {}), page: String(page - 1) }).toString()}`} className="text-steel">
                  ← Newer
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/backblasts?${new URLSearchParams({ ...(ao ? { ao } : {}), ...(search ? { search } : {}), page: String(page + 1) }).toString()}`} className="text-steel">
                  Older →
                </Link>
              )}
            </div>
          </nav>
        </div>
      </section>

      <MarqueeRibbon />
    </>
  );
}
