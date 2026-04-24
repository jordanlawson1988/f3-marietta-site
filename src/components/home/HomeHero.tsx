import Image from "next/image";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { CornerBracket } from "@/components/ui/brand/CornerBracket";
import { EyebrowLabel } from "@/components/ui/brand/EyebrowLabel";
import { MeterBar } from "@/components/ui/brand/MeterBar";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Props = {
  weeklyPax: number;
};

export function HomeHero({ weeklyPax }: Props) {
  return (
    <section className="relative overflow-hidden bg-ink text-bone min-h-[calc(100vh-136px)] flex flex-col">
      {/* Layered background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 28% 35%, rgba(47,110,137,.32), transparent 60%), radial-gradient(ellipse at 78% 72%, rgba(30,58,95,.45), transparent 70%), radial-gradient(ellipse at 55% 90%, rgba(184,74,26,.08), transparent 55%), linear-gradient(180deg,#10141a 0%,#0a0d12 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-topo-dark opacity-60 mix-blend-screen"
      />

      {/* Meter bar */}
      <div className="relative z-10 max-w-[1320px] mx-auto w-full px-7">
        <MeterBar
          variant="ink"
          className="!border-t-0 !px-0"
          left={<MonoTag variant="bone">Marietta Region · F3 Nation</MonoTag>}
          right={<MonoTag variant="bone">{`Muster Log · ${weeklyPax} ${weeklyPax === 1 ? "man" : "men"} posted this week`}</MonoTag>}
        />
      </div>

      {/* Content grid */}
      <div className="relative z-10 flex-1 max-w-[1320px] mx-auto w-full px-7 py-16 grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-12 items-center">
        <div>
          <EyebrowLabel variant="steel" withRule>Marietta Region · F3 Nation</EyebrowLabel>
          <h1 className="mt-7 font-display font-bold uppercase leading-[.86] text-[clamp(48px,7.2vw,120px)] tracking-[-.01em]">
            <span className="block overflow-hidden"><span className="inline-block" style={{ animation: "word-rise .9s cubic-bezier(.2,.8,.2,1) both" }}>Remove your</span></span>
            <span className="block overflow-hidden"><span className="inline-block text-steel relative" style={{ animation: "word-rise .9s .1s cubic-bezier(.2,.8,.2,1) both" }}>
              obstacles,
              <span className="absolute left-0 right-0 bottom-[.12em] h-[.06em] bg-steel origin-left" style={{ animation: "scope-underline 1.2s .6s cubic-bezier(.2,.8,.2,1) both" }} />
            </span></span>
            <span className="block overflow-hidden"><span className="inline-block" style={{ animation: "word-rise .9s .2s cubic-bezier(.2,.8,.2,1) both" }}>unlock your</span></span>
            <span className="block overflow-hidden"><span className="inline-block text-bone/55" style={{ animation: "word-rise .9s .3s cubic-bezier(.2,.8,.2,1) both" }}>potential.</span></span>
          </h1>
          <p className="mt-8 max-w-[540px] text-[18px] leading-[1.55] text-bone/82">
            Free, peer-led workouts for men in Marietta, GA. We start in the gloom at 05:30, rain or shine — and we finish as better husbands, fathers, friends, and leaders.
          </p>
          <div className="mt-9 flex flex-wrap gap-3.5">
            <ChamferButton href="/workouts" variant="steel" size="lg">Find a Workout</ChamferButton>
            <ChamferButton href="/about" variant="ghost" size="lg" arrow={false}>What is F3?</ChamferButton>
          </div>

          <div className="mt-10 max-w-[560px] grid grid-cols-3 gap-7 border-t border-bone/12 pt-7">
            {[
              { num: "5:30", em: "am", lbl: "First Whistle" },
              { num: "$0", em: "", lbl: "Always Free" },
              { num: "4", em: "/wk", lbl: "Active AOs" },
            ].map((m) => (
              <div key={m.lbl}>
                <div className="font-display font-bold text-[42px] leading-none text-bone">
                  {m.num}
                  {m.em && <span className="text-steel text-[24px] ml-0.5">{m.em}</span>}
                </div>
                <div className="mt-1.5 font-mono text-[10px] tracking-[.15em] uppercase text-bone/55">{m.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Emblem card */}
        <div className="relative aspect-square max-w-[520px] w-full ml-auto">
          <div
            aria-hidden="true"
            className="absolute -inset-10 rounded-full border border-dashed border-steel/40"
            style={{ animation: "rotate-ring 60s linear infinite" }}
          />
          <div
            className="relative h-full w-full border border-bone/18 bg-bone/5 backdrop-blur-[6px] flex items-center justify-center"
            style={{ clipPath: "polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px)" }}
          >
            <CornerBracket corner="tl" color="steel" />
            <CornerBracket corner="tr" color="steel" />
            <CornerBracket corner="bl" color="steel" />
            <CornerBracket corner="br" color="steel" />
            <div className="relative w-[82%] aspect-square" style={{ animation: "float-logo 8s ease-in-out infinite" }}>
              <Image
                src="/images/new-f3-marietta-logo.png"
                alt="F3 Marietta cannon emblem"
                fill
                className="object-contain"
                style={{ filter: "invert(1) contrast(1.1) drop-shadow(0 20px 40px rgba(0,0,0,.5))" }}
                priority
              />
            </div>
          </div>
          <div className="absolute -top-4 left-0 font-mono text-[10px] tracking-[.2em] uppercase text-bone/60">// ID · F3.MAR.01</div>
          <div className="absolute -top-4 right-0 font-mono text-[10px] tracking-[.2em] uppercase text-bone/60">REV · 2025</div>
          <div className="absolute -bottom-4 left-0 font-mono text-[10px] tracking-[.2em] uppercase text-bone/60">Fitness · Fellowship · Faith</div>
          <div className="absolute -bottom-4 right-0 font-mono text-[10px] tracking-[.2em] uppercase text-steel">// Gloom · 05:30 EDT</div>
        </div>
      </div>
    </section>
  );
}
