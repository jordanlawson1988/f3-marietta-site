import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";

export const metadata: Metadata = {
  title: "New Here",
  description: "How to post at your first F3 Marietta workout.",
};

const STEPS = [
  { num: "01", name: "Arrive", body: "Show up 5 minutes early at 05:25. The workout starts at 05:30 sharp. Wear clothes you can get wet and muddy." },
  { num: "02", name: "Circle Up", body: "Introduce yourself by first name. Say 'FNG' — Friendly New Guy — so the Q knows to watch out for you." },
  { num: "03", name: "Warm-Up", body: "The Q leads a warm-up. SSH, Don Quixotes, Imperial Walkers. Everybody goes at their own pace. Modify any exercise." },
  { num: "04", name: "The Thang", body: "45 minutes of peer-led exercise outdoors. Bodyweight, maybe a ruck, maybe a run. Heavy, skinny, fast, slow — we move as a unit." },
  { num: "05", name: "COT", body: "Circle of Trust closes every workout. Name-o-rama, a reflection or prayer, and a charge back into the day." },
];

const BRING = [
  "Shoes you can get wet",
  "A t-shirt and shorts you don't mind sacrificing",
  "A good attitude",
  "Nothing else — no cash, no equipment",
];

export default function NewHerePage() {
  return (
    <>
      <PageHeader
        eyebrow="§ First Whistle"
        title={<>Your First<br />Post.</>}
        kicker={<>The workout is free. Peer-led. Held outdoors rain or shine. Here&apos;s how to show up.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-14">
          <div className="border-y border-line-soft">
            {STEPS.map((s, i) => (
              <ScrollReveal
                key={s.num}
                delayMs={i * 60}
                className={`flex items-start gap-8 py-9 ${i < STEPS.length - 1 ? "border-b border-line-soft" : ""}`}
              >
                <div className="font-display font-bold uppercase text-steel leading-none text-[clamp(54px,7vw,88px)]">{s.num}</div>
                <div className="flex-1 pt-2">
                  <h3 className="font-display font-bold uppercase text-[24px] tracking-[-.01em]">{s.name}</h3>
                  <p className="mt-2 text-[16px] leading-[1.6] text-muted max-w-xl">{s.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div>
            <ScrollReveal>
              <ClipFrame padding="p-8">
                <MonoTag>// What to Bring</MonoTag>
                <ul className="mt-5 space-y-3">
                  {BRING.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[15px] text-ink">
                      <span className="mt-2 inline-block w-1.5 h-1.5 bg-steel" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </ClipFrame>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <CTABand
        variant="gradient"
        title={<>Plan your<br />first post.</>}
        kicker={<>Find a workout, grab a buddy, and show up. We&apos;ll handle the rest.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
