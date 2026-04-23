import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export const metadata: Metadata = {
  title: "FNGs",
  description: "What FNG means and how to post for the first time.",
};

export default function FNGPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ FNG · 01"
        title={<>Friendly<br />New Guy.</>}
        kicker={<>Every man was an FNG once. Here&apos;s what it means.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {[
            { h: "What it means", p: "FNG = Friendly New Guy. It's what we call every man posting for the first time. No shame, no ceremony, just a welcome and a plan to watch out for you in the first workout." },
            { h: "What to bring", p: "Shoes you can get wet. A t-shirt and shorts. A good attitude. That's it — no cash, no equipment, no paperwork." },
            { h: "Your F3 name", p: "At your first post, the PAX will give you an F3 name. It sticks. It's part of the tradition — part joke, part badge of honor." },
          ].map((b, i) => (
            <ScrollReveal key={b.h} delayMs={i * 80} className="border border-line-soft p-8 bg-bone">
              <h3 className="font-display font-bold uppercase text-[24px] tracking-[-.01em]">{b.h}</h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-muted">{b.p}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <CTABand
        variant="steel"
        title={<>Find tomorrow&apos;s<br />post.</>}
        primary={{ label: "See the Schedule", href: "/workouts" }}
        secondary={{ label: "Full Walkthrough", href: "/new-here" }}
      />
    </>
  );
}
