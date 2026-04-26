import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export const metadata: Metadata = {
  title: "Community",
  description: "Fellowship ledger — service projects, 2nd F gatherings, and community events.",
};

type Entry = { date: string; title: string; body: string; tag: "Service" | "2nd F" | "Event" };

const ENTRIES: Entry[] = [
  { date: "UPCOMING · MAY 17", title: "Habitat for Humanity Build Day", body: "Morning build with a Marietta partner site. Open to PAX and families. Coffee + donuts provided.", tag: "Service" },
  { date: "MONTHLY · FIRST SAT", title: "Coffeeteria · Kennesaw", body: "Post-workout coffee and conversation at the Marietta Square. No agenda. Families welcome.", tag: "2nd F" },
  { date: "ANNUAL · NOVEMBER", title: "F3 Marietta Convergence", body: "One big workout with the full region. Family picnic after. Bring the 2.0s.", tag: "Event" },
];

export default function CommunityPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ The Ledger"
        title={<>Fellowship<br />Ledger.</>}
        kicker={<>The gloom builds the men. The community builds the region. Here&apos;s what&apos;s on the books.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ENTRIES.map((e, i) => (
            <ScrollReveal key={e.title} delayMs={i * 80} className="border border-line-soft p-7 bg-bone">
              <div className="flex items-center justify-between mb-5">
                <MonoTag variant="steel">{e.date}</MonoTag>
                <StatusChip variant={e.tag === "Service" ? "active" : e.tag === "2nd F" ? "draft" : "fng"}>{e.tag}</StatusChip>
              </div>
              <h3 className="font-display font-bold uppercase text-[24px] tracking-[-.01em] leading-tight">{e.title}</h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-muted">{e.body}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <CTABand
        variant="steel"
        title={<>Join the<br />ledger.</>}
        kicker={<>We&apos;re always planning the next post, the next project, the next gathering. Get on the list.</>}
        primary={{ label: "Contact Us", href: "/contact" }}
      />
    </>
  );
}
