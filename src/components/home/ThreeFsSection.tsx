import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

type F = { num: string; name: string; title: string; description: string; tag: string; icon: React.ReactNode };

const FS: F[] = [
  {
    num: "// 01",
    name: "Fitness",
    title: "Fitness",
    description:
      "Start together. End together. The workout is open to every man at every fitness level. Heavy or skinny, fast or slow — we move as one unit. No man left behind.",
    tag: "→ 45–60 min · Bodyweight · Outdoors",
    icon: (
      <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="8" y="26" width="6" height="12" />
        <rect x="50" y="26" width="6" height="12" />
        <rect x="14" y="30" width="36" height="4" />
        <rect x="22" y="20" width="20" height="24" fill="none" />
      </svg>
    ),
  },
  {
    num: "// 02",
    name: "Fellowship",
    title: "Fellowship",
    description:
      "The bonds built in the gloom don't end at the whistle. Second F — coffee, cookouts, service projects, accountability groups — that brotherhood is what gets you through the other 23 hours.",
    tag: "→ Coffeeteria · Service · 2nd F",
    icon: (
      <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="24" cy="22" r="8" />
        <circle cx="40" cy="22" r="8" />
        <path d="M12 52 C12 42, 20 38, 24 38 C28 38, 36 42, 36 52" />
        <path d="M28 52 C28 44, 36 40, 40 40 C44 40, 52 44, 52 52" />
      </svg>
    ),
  },
  {
    num: "// 03",
    name: "Faith",
    title: "Faith",
    description:
      "Not a denomination. A belief in something bigger than yourself. Every workout closes with a Circle of Trust — name-o-rama, a prayer or reflection, and a charge back into the day.",
    tag: "→ COT · Reflection · Charge",
    icon: (
      <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M32 8 L56 52 L8 52 Z" />
        <circle cx="32" cy="36" r="3" />
      </svg>
    ),
  },
];

export function ThreeFsSection() {
  return (
    <section id="about" className="relative bg-bone py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 01 · The Mission"
            h2={<>Three F&apos;s.<br />One Brotherhood.</>}
            kicker={
              <>
                F3 is a national network of free, peer-led workouts for men. Our mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.
              </>
            }
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 border border-line-soft">
          {FS.map((f, i) => (
            <ScrollReveal
              key={f.name}
              delayMs={i * 100}
              className={`group relative p-10 bg-bone transition-colors duration-300 hover:bg-ink hover:text-bone ${
                i < FS.length - 1 ? "md:border-r border-line-soft" : ""
              } ${i > 0 ? "border-t md:border-t-0 border-line-soft" : ""}`}
            >
              <div className="font-mono text-[11px] tracking-[.2em] uppercase text-muted group-hover:text-steel transition-colors">
                {f.num}
              </div>
              <div className="mt-6 w-16 h-16 rounded-full border border-line-soft text-ink group-hover:text-bone group-hover:border-bone/40 flex items-center justify-center transition-colors">
                {f.icon}
              </div>
              <h3 className="mt-6 font-display font-bold uppercase text-[clamp(42px,5vw,64px)] leading-none tracking-[-.01em] group-hover:text-steel transition-colors">
                {f.name}
              </h3>
              <div className="mt-4 h-px w-10 bg-line-soft group-hover:bg-bone/40" />
              <p className="mt-5 text-[15px] leading-[1.6]">{f.description}</p>
              <div className="mt-6 font-mono text-[11px] tracking-[.15em] uppercase text-muted group-hover:text-bone/70">
                {f.tag}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
