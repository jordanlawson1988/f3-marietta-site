import Link from "next/link";
import { getBackblastsPaginated } from "@/lib/backblast/getBackblastsPaginated";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { BackblastFeatureCard } from "@/components/ui/BackblastFeatureCard";
import { BackblastListItem } from "@/components/ui/BackblastListItem";

export async function BackblastsPreviewSection() {
  const { rows } = await getBackblastsPaginated({ page: 1, pageSize: 6 });
  const [feature, ...rest] = rows;

  return (
    <section id="reports" className="bg-bone py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 03 · From the Gloom"
            h2={<>Backblasts.</>}
            kicker={<>Every post produces a record. Here are the most recent backblasts from across the region.</>}
          />
        </ScrollReveal>

        {feature ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 items-stretch">
            <ScrollReveal><BackblastFeatureCard item={feature} /></ScrollReveal>
            <ScrollReveal delayMs={80}>
              <div className="border border-line-soft">
                {rest.map((item) => (
                  <BackblastListItem key={item.id} item={item} />
                ))}
              </div>
            </ScrollReveal>
          </div>
        ) : (
          <div className="py-16 text-center text-muted font-mono text-[12px] tracking-[.15em] uppercase">
            Backblasts loading · check back soon
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            href="/backblasts"
            className="inline-flex items-center gap-2 font-display font-semibold uppercase tracking-[.1em] text-[14px] text-steel hover:gap-3 transition-all"
          >
            All reports <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
