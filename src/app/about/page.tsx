import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { CreedQuote } from "@/components/ui/brand/CreedQuote";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";
import { PaxMosaic } from "@/components/about/PaxMosaic";
import { BrotherhoodGallery } from "@/components/about/BrotherhoodGallery";

export const metadata: Metadata = {
  title: "About",
  description: "F3 Marietta history, mission, leadership, and the men in the gloom.",
};

// Both photo galleries pull recent backblasts from the DB. ISR keeps the
// page fast while still surfacing newly-posted PAX photos within 5 minutes.
export const revalidate = 300;

const TIMELINE = [
  { date: "JUN 2024", title: "Battlefield Launch", body: "The Battlefield stands up at Marietta High School. First muster, 6 PAX." },
  { date: "SEP 2024", title: "The Last Stand", body: "A second AO opens. The region is forming." },
  { date: "DEC 2025", title: "Region Launch", body: "F3 Marietta is recognized as an official F3 Nation region." },
  { date: "TODAY",   title: "Forging On",    body: "New PAX every week. New AOs on the horizon." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ F3 Marietta"
        variant="ink"
        title={<>Men. Marietta.<br />Since 2024.</>}
        kicker={<>A growing community of men dedicated to becoming better leaders in our families, workplaces, and community.</>}
        meter={{ left: "Coordinates · 33.9526° N, 84.5499° W", right: "Region · Marietta, GA" }}
      />

      {/* Real PAX photos pulled from the most-recent backblasts. Hidden if
          the database doesn't have enough real photos to render honestly. */}
      <PaxMosaic />

      <section className="bg-bone py-24">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <SectionHead
              eyebrow="§ 01 · The Mission"
              h2={<>Plant. Grow.<br />Serve.</>}
              kicker={
                <>
                  F3 is a national network of free, peer-led workouts for men. Our mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.
                </>
              }
            />
          </ScrollReveal>
        </div>
      </section>

      {/* Editorial 3-photo gallery. Lives between the mission statement
          and the timeline so the abstract framing ("plant/grow/serve")
          gets immediately grounded in real faces and real beatdowns. */}
      <BrotherhoodGallery />

      <section className="bg-bone py-24">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <SectionHead
              eyebrow="§ 03 · The Record"
              h2={<>A short history.</>}
              align="left"
            />
          </ScrollReveal>
          <ol className="relative border-l border-line-soft ml-2">
            {TIMELINE.map((t, i) => (
              <ScrollReveal
                key={t.date}
                delayMs={i * 80}
                as="li"
                className="relative pl-8 pb-10 last:pb-0"
              >
                <span className="absolute left-[-7px] top-2 w-3 h-3 rounded-full bg-steel" aria-hidden="true" />
                <MonoTag variant="steel">{t.date}</MonoTag>
                <h3 className="mt-2 font-display font-bold uppercase text-[28px] tracking-[-.01em] leading-tight">{t.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-muted max-w-xl">{t.body}</p>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink text-bone py-24 text-center">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <CreedQuote variant="ink">
              We plant. We grow. <span className="text-steel">We serve.</span>
            </CreedQuote>
          </ScrollReveal>
        </div>
      </section>

      <MarqueeRibbon />

      <CTABand
        variant="steel"
        title={<>Your First<br />Post.</>}
        kicker={<>Find a workout, grab a buddy, and show up. We&apos;ll do the rest.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
        secondary={{ label: "What to Expect", href: "/what-to-expect" }}
      />
    </>
  );
}
