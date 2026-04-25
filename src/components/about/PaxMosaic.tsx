import Image from "next/image";
import { getRecentBackblastPhotosWithMeta } from "@/lib/backblast/getRecentBackblastPhotos";
import { EyebrowLabel } from "@/components/ui/brand/EyebrowLabel";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { TopoBackground } from "@/components/ui/brand/TopoBackground";

const TARGET = 6;
const MIN_TO_RENDER = 3;

function formatStamp(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${mo}.${d}.${y.slice(2)}`;
}

/**
 * Edge-of-hero PAX mosaic. Surfaces real, recent backblast photos pulled
 * from Slack so the About page opens with a tangible "this is the gloom,
 * this week" moment instead of a stock visual.
 *
 * Hides itself if fewer than MIN_TO_RENDER real photos exist — we never
 * pad with stock imagery here. Honest or absent, never decorated.
 */
export async function PaxMosaic() {
  const photos = await getRecentBackblastPhotosWithMeta(TARGET);
  if (photos.length < MIN_TO_RENDER) return null;

  return (
    <section
      data-testid="about-pax-mosaic"
      className="relative bg-ink text-bone py-20 overflow-hidden"
    >
      <TopoBackground variant="dark" />
      <div className="relative z-10 max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <EyebrowLabel variant="steel" withRule>
                § This Week in the Gloom
              </EyebrowLabel>
              <h2 className="mt-4 font-display font-bold uppercase leading-[.92] text-[clamp(34px,4.6vw,60px)] tracking-[-.01em]">
                Real men.<br />
                <span className="font-serif italic text-steel normal-case tracking-normal">
                  Real
                </span>{" "}
                muster.
              </h2>
            </div>
            <p className="max-w-sm text-[15px] leading-[1.6] text-bone/70">
              Every photo below is a real F3 Marietta beatdown — pulled
              straight from the latest backblasts. Your neighbors. 05:30.
              No filter.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delayMs={120}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((p, i) => {
              const stamp = formatStamp(p.eventDate);
              return (
                <figure
                  key={p.url}
                  className="group relative aspect-square overflow-hidden border border-bone/10 clip-chamfer-sm"
                >
                  <Image
                    src={p.url}
                    alt={
                      stamp
                        ? `F3 Marietta PAX in the gloom on ${stamp}`
                        : "F3 Marietta PAX in the gloom"
                    }
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    priority={i === 0}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent"
                  />
                  {stamp && (
                    <figcaption className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <MonoTag variant="bone">§ {stamp}</MonoTag>
                      <span className="font-mono text-[10px] tracking-[.2em] uppercase text-bone/50">
                        Marietta
                      </span>
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
