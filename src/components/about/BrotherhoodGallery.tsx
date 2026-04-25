import Image from "next/image";
import { getRecentBackblastPhotosWithMeta } from "@/lib/backblast/getRecentBackblastPhotos";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

const TARGET = 3;

function formatStamp(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${mo}.${d}.${y.slice(2)}`;
}

/**
 * Editorial 3-photo composition. One large hero photo on the left
 * anchors the layout; two stacked photos on the right add rhythm.
 *
 * Pulls from the SAME source as PaxMosaic but slices a different window
 * so the two galleries don't repeat. If we don't have enough distinct
 * photos to fill all three slots, hide the section entirely (no padding
 * with stock).
 */
export async function BrotherhoodGallery() {
  // Over-fetch so PaxMosaic above can take the freshest 6 and we still
  // have distinct content for these 3. Falls back gracefully if the
  // database hasn't accumulated that many photos yet.
  const all = await getRecentBackblastPhotosWithMeta(12);
  const photos = all.slice(6, 6 + TARGET);
  // If we couldn't get 3 distinct from the older slice, try from the top
  // (most regions won't have 9+ photos for a long time).
  const usable = photos.length === TARGET ? photos : all.slice(0, TARGET);
  if (usable.length < TARGET) return null;

  const [hero, top, bottom] = usable;

  return (
    <section
      data-testid="about-brotherhood-gallery"
      className="bg-bone-2 py-24"
    >
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 02 · The Brotherhood"
            h2={<>Faces of the gloom.</>}
            kicker={
              <>
                Real men, every Tuesday and Thursday at 05:30. Not stock.
                Not models. Your neighbors, your coworkers, your accountability
                partners — sharpening each other in the dark.
              </>
            }
          />
        </ScrollReveal>

        <ScrollReveal delayMs={140}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Hero — left column on desktop */}
            <figure className="relative lg:col-span-7 aspect-[4/3] lg:aspect-auto lg:min-h-[520px] overflow-hidden border border-line-soft clip-chamfer-sm group">
              <Image
                src={hero.url}
                alt={
                  hero.eventDate
                    ? `F3 Marietta brotherhood — ${formatStamp(hero.eventDate)}`
                    : "F3 Marietta brotherhood"
                }
                fill
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-tr from-ink/75 via-ink/20 to-transparent"
              />
              <figcaption className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                <div>
                  <MonoTag variant="bone">
                    § {hero.eventDate ? formatStamp(hero.eventDate) : "Marietta"}
                  </MonoTag>
                  <div className="mt-1 font-display font-bold uppercase text-bone text-[clamp(22px,2.4vw,32px)] leading-[1] tracking-[-.005em]">
                    The Gloom Doesn&apos;t Care.
                  </div>
                </div>
                <span className="font-mono text-[10px] tracking-[.22em] uppercase text-bone/60 hidden sm:inline">
                  05:30 / GA
                </span>
              </figcaption>
            </figure>

            {/* Right column — two stacked photos */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-5">
              {[top, bottom].map((p, i) => {
                const stamp = formatStamp(p.eventDate);
                return (
                  <figure
                    key={p.url}
                    className="relative aspect-[4/3] overflow-hidden border border-line-soft clip-chamfer-sm group"
                  >
                    <Image
                      src={p.url}
                      alt={
                        stamp
                          ? `F3 Marietta PAX — ${stamp}`
                          : "F3 Marietta PAX"
                      }
                      fill
                      sizes="(min-width: 1024px) 36vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent"
                    />
                    <figcaption className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <MonoTag variant="bone">
                        § {stamp ?? (i === 0 ? "Battlefield" : "Last Stand")}
                      </MonoTag>
                      <span className="font-mono text-[10px] tracking-[.2em] uppercase text-bone/50">
                        {i === 0 ? "FNG-friendly" : "Open"}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delayMs={220}>
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-line-soft pt-6">
            <p className="font-display uppercase text-[15px] tracking-[.06em] text-ink/80">
              Every photo: a real beatdown. Every face: a real HIM.
            </p>
            <a
              href="/backblasts"
              className="font-mono text-[11px] tracking-[.2em] uppercase text-steel hover:text-steel-2 transition-colors inline-flex items-center gap-2"
            >
              See every backblast →
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
