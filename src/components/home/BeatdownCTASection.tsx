import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { EyebrowLabel } from "@/components/ui/brand/EyebrowLabel";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export function BeatdownCTASection() {
  return (
    <section className="bg-bone-2 py-24">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <div className="relative border-[1.5px] border-ink bg-bone p-10 md:p-14 clip-chamfer text-center">
            <div className="flex justify-center">
              <EyebrowLabel variant="muted" withRule>
                § For the Q
              </EyebrowLabel>
            </div>
            <h2 className="mt-5 font-display font-bold uppercase leading-[.92] text-[clamp(36px,5vw,68px)] tracking-[-.01em]">
              Q&apos;ing tomorrow?
              <br />
              <span className="font-serif italic text-steel normal-case tracking-normal">Build</span> a beatdown.
            </h2>
            <p className="mt-6 mx-auto max-w-2xl text-[16px] leading-[1.6] text-muted">
              F3 Marietta&apos;s own AI tool — pulls from our backblasts, the Exicon, and famous F3
              beatdowns to draft a full workout in seconds. Edit, swap, print. No more relying on
              generic ChatGPT the night before.
            </p>
            <div className="mt-8 flex justify-center">
              <ChamferButton href="/beatdown-builder" variant="ink" size="lg">
                Build a Beatdown
              </ChamferButton>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
