import Image from "next/image";
import { getImpactStats } from "@/lib/stats/getImpactStats";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { EyebrowLabel } from "@/components/ui/brand/EyebrowLabel";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { TopoBackground } from "@/components/ui/brand/TopoBackground";

export async function ImpactSection() {
  const stats = await getImpactStats();
  const tiles = [
    { num: stats.uniqueHim, label: "Unique HIM Posted" },
    { num: stats.workoutsLed, label: "Workouts Led" },
    { num: stats.activeAOs, label: "Active AOs" },
    { num: stats.fngsThisYear, label: "FNGs This Year" },
  ];

  return (
    <section className="relative bg-ink text-bone py-28 overflow-hidden">
      {/* Real PAX photo — heavy ink gradient keeps text legible */}
      <Image
        src="/images/MariettaHomePage.jpeg"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="object-cover opacity-40"
        priority={false}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(10,13,18,.95) 0%, rgba(10,13,18,.82) 45%, rgba(10,13,18,.55) 100%)",
        }}
      />
      <TopoBackground variant="dark" />
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <ScrollReveal>
          <EyebrowLabel variant="steel" withRule>§ 04 · Impact</EyebrowLabel>
          <h2 className="mt-5 font-display font-bold uppercase leading-[.86] text-[clamp(46px,7vw,96px)] tracking-[-.01em]">
            Built in Marietta.
            <br />
            <span className="font-serif italic text-steel normal-case tracking-normal">Forged</span> in the gloom.
          </h2>
          <p className="mt-8 max-w-md text-[16px] leading-[1.6] text-bone/85">
            We launched The Battlefield at Marietta High School in June 2024. The region launched in December 2025. We&apos;re just getting started.
          </p>
          <div className="mt-8">
            <ChamferButton href="/new-here" variant="steel" size="lg">Your First Post</ChamferButton>
          </div>
        </ScrollReveal>

        <ScrollReveal delayMs={100}>
          <div className="grid grid-cols-2 border border-bone/20 bg-ink/55 backdrop-blur-[3px]">
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className={`px-7 py-10 ${i % 2 === 0 ? "border-r border-bone/20" : ""} ${i < 2 ? "border-b border-bone/20" : ""}`}
              >
                <div className="font-display font-bold text-steel text-[clamp(48px,6vw,84px)] leading-none">
                  {t.num}
                </div>
                <div className="mt-3 font-mono text-[11px] tracking-[.15em] uppercase text-bone/75">{t.label}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
