import { CreedQuote } from "@/components/ui/brand/CreedQuote";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { TopoBackground } from "@/components/ui/brand/TopoBackground";

type Principle = { num: string; title: string; body: string };

const PRINCIPLES: Principle[] = [
  { num: "01", title: "Free of Charge", body: "No fees. No membership. No catch. You show up." },
  { num: "02", title: "Open to All Men", body: "Any age, any fitness level. The door is always open." },
  { num: "03", title: "Held Outdoors", body: "Rain or shine. Heat or cold. We embrace the elements." },
  { num: "04", title: "Peer-Led", body: "No instructors. Men take turns Q-ing the workout." },
  { num: "05", title: "Ends in COT", body: "Circle of Trust. Reflection. Charge back into the day." },
];

export function CreedPrinciplesSection() {
  return (
    <section className="relative bg-ink text-bone py-28 overflow-hidden">
      <TopoBackground variant="dark" />
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 text-center">
        <ScrollReveal>
          <CreedQuote variant="ink">
            Leave no man behind, but leave no man <span className="text-steel not-italic" style={{ fontStyle: "italic" }}>where you found him.</span>
          </CreedQuote>
        </ScrollReveal>
      </div>

      <div className="relative z-10 max-w-[1320px] mx-auto px-7 mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-t border-bone/12 border-b">
        {PRINCIPLES.map((p, i) => (
          <ScrollReveal
            key={p.num}
            delayMs={i * 80}
            className={`p-8 ${i < PRINCIPLES.length - 1 ? "lg:border-r border-bone/12" : ""} ${i > 0 ? "border-t lg:border-t-0 border-bone/12" : ""}`}
          >
            <div className="font-display font-bold uppercase text-steel text-[72px] leading-none">{p.num}</div>
            <h4 className="mt-4 font-display font-bold uppercase text-[18px] tracking-[.05em]">{p.title}</h4>
            <p className="mt-3 text-[13px] leading-[1.55] text-bone/60">{p.body}</p>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
