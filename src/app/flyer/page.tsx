import type { Metadata } from "next";
import Image from "next/image";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import type { WorkoutScheduleRow } from "@/types/workout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "F3 Marietta Workout Flyer",
  description: "Printable schedule of every active F3 Marietta AO. Free. Outdoor. Peer-led.",
};

const DAYS: Array<{ idx: number; label: string; short: string }> = [
  { idx: 1, label: "Monday", short: "MON" },
  { idx: 2, label: "Tuesday", short: "TUE" },
  { idx: 3, label: "Wednesday", short: "WED" },
  { idx: 4, label: "Thursday", short: "THU" },
  { idx: 5, label: "Friday", short: "FRI" },
  { idx: 6, label: "Saturday", short: "SAT" },
  { idx: 7, label: "Sunday", short: "SUN" },
];

function formatTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function workoutTypeAccent(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("ruck")) return "var(--olive)";
  if (t.includes("run")) return "var(--steel)";
  if (t.includes("csaup")) return "var(--brass)";
  if (t.includes("conv")) return "var(--brass)";
  // Bootcamp + anything else = rust
  return "var(--rust)";
}

export default async function FlyerPage() {
  const schedule = await getWorkoutSchedule();

  // Flatten to (day, workout, region) for sorting and primary-first display.
  type Row = {
    day: number;
    dayShort: string;
    workout: WorkoutScheduleRow;
    regionName: string;
    isPrimary: boolean;
  };

  const rows: Row[] = [];
  for (const d of DAYS) {
    const day = schedule[d.idx];
    if (!day) continue;
    for (const rg of day.regions) {
      for (const w of rg.workouts) {
        rows.push({
          day: d.idx,
          dayShort: d.short,
          workout: w,
          regionName: rg.region.name,
          isPrimary: rg.region.is_primary,
        });
      }
    }
  }

  // Marietta region only — nearby regions live on the /workouts page but
  // shouldn't compete for ink on the flyer. The flyer is the Marietta
  // recruitment artifact.
  const byDay = DAYS.map((d) => ({
    ...d,
    primary: rows.filter((r) => r.day === d.idx && r.isPrimary),
  })).filter((d) => d.primary.length > 0);

  const totalActiveAos = new Set(
    rows.filter((r) => r.isPrimary).map((r) => r.workout.ao_name),
  ).size;

  return (
    <main className="flyer-root bg-[var(--bone)] text-[var(--ink)] min-h-screen">
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.4in;
        }
        @media print {
          .flyer-root { background: var(--bone) !important; }
          .no-print { display: none !important; }
          .flyer-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0.5in 0.55in !important;
            max-width: none !important;
          }
        }
        .flyer-page {
          max-width: 8.5in;
          margin: 0 auto;
          padding: 1.25rem;
          box-shadow: 0 30px 80px rgba(12,12,12,.18), 0 8px 24px rgba(12,12,12,.10);
          background: var(--bone);
        }
        @media (min-width: 640px) {
          .flyer-page {
            padding: 0.5in 0.55in;
            min-height: 11in;
          }
        }
      `}</style>

      <div className="no-print py-6 text-center">
        <p className="font-mono text-[11px] tracking-[.18em] uppercase text-[var(--muted)]">
          // Use your browser&apos;s Print &middot; choose &quot;Save as PDF&quot; for digital share
        </p>
      </div>

      <article className="flyer-page relative">
        {/* — Header hero — */}
        <header className="relative pb-5 border-b-[3px] border-[var(--ink)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-5">
            <div className="flex items-center gap-4">
              <Image
                src="/images/new-f3-marietta-logo.png"
                alt="F3 Marietta cannon emblem"
                width={84}
                height={84}
                className="h-16 w-16 sm:h-[78px] sm:w-[78px] rounded-full object-cover border-[2px] border-[var(--ink)] shrink-0"
              />
              <div className="leading-none min-w-0">
                <p className="font-mono text-[10px] tracking-[.22em] uppercase text-[var(--muted)] mb-2">
                  // F3 Nation &middot; Marietta Region
                </p>
                <h1 className="font-display font-bold uppercase tracking-[-.01em] text-[36px] sm:text-[clamp(40px,5vw,52px)] leading-none">
                  F3 Marietta
                </h1>
                <p className="mt-2 font-display font-semibold uppercase tracking-[.18em] text-[11px] sm:text-[12px] text-[var(--ink-2)]">
                  Fitness &middot; Fellowship &middot; Faith
                </p>
              </div>
            </div>

            <div className="self-start sm:self-auto">
              <div className="inline-block border-[2px] border-[var(--ink)] px-3 py-2">
                <p className="font-mono text-[9px] tracking-[.22em] uppercase text-[var(--muted)]">
                  // Active AOs
                </p>
                <p className="font-display font-bold text-[36px] sm:text-[44px] leading-none mt-1">
                  {totalActiveAos}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* — Promise band — */}
        <section className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            { tag: "Cost", value: "Free" },
            { tag: "Where", value: "Outdoors" },
            { tag: "Who", value: "Open to All Men" },
            { tag: "Led By", value: "Peer-Led" },
          ].map((stat) => (
            <div
              key={stat.tag}
              className="border border-[var(--line-soft)] bg-[var(--bone-2)] px-2 py-2"
            >
              <p className="font-mono text-[9px] tracking-[.22em] uppercase text-[var(--muted)]">
                // {stat.tag}
              </p>
              <p className="font-display font-bold uppercase tracking-[.04em] text-[14px] mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* — Schedule grid — */}
        <section className="mt-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
            <h2 className="font-display font-bold uppercase tracking-[-.005em] text-[22px] sm:text-[26px] leading-none">
              The Schedule
            </h2>
            <p className="font-mono text-[10px] tracking-[.18em] uppercase text-[var(--muted)]">
              // gloom &middot; 0530 weekdays &middot; 0600 saturdays
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            {byDay.map((d) => (
              <div key={d.idx} className="break-inside-avoid">
                <div className="flex items-baseline gap-2 mb-1.5 pb-1 border-b border-[var(--line-soft)]">
                  <span className="font-display font-bold uppercase tracking-[.04em] text-[15px] text-[var(--ink)]">
                    {d.label}
                  </span>
                  <span className="font-mono text-[9px] tracking-[.18em] uppercase text-[var(--muted)] ml-auto">
                    {d.primary.length} post{d.primary.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {d.primary.map((r, i) => (
                    <li key={`${d.idx}-${i}`} className="flex items-stretch gap-2">
                      <span
                        className="inline-block w-[3px] shrink-0 self-stretch"
                        style={{ background: workoutTypeAccent(r.workout.workout_type) }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-[10px] tracking-[.12em] uppercase text-[var(--ink-2)] shrink-0">
                            {formatTime(r.workout.start_time)}
                          </span>
                          <span className="font-display font-bold uppercase tracking-[.02em] text-[13px] leading-tight">
                            {r.workout.ao_name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="font-mono text-[9px] tracking-[.18em] uppercase shrink-0" style={{ color: workoutTypeAccent(r.workout.workout_type) }}>
                            // {r.workout.workout_type}
                          </span>
                          <span className="font-mono text-[9px] text-[var(--muted)]">
                            {r.workout.location_name ?? r.workout.address}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* — Type legend — */}
        <section className="mt-5 pt-3 border-t border-[var(--line-soft)]">
          <p className="font-mono text-[9px] tracking-[.22em] uppercase text-[var(--muted)] mb-2">
            // workout types
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {[
              { label: "Bootcamp", color: "var(--rust)" },
              { label: "Run", color: "var(--steel)" },
              { label: "Ruck", color: "var(--olive)" },
              { label: "CSAUP / Convergence", color: "var(--brass)" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2">
                <span
                  className="inline-block h-[10px] w-[3px]"
                  style={{ background: t.color }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[10px] tracking-[.14em] uppercase text-[var(--ink-2)]">
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* — Footer — */}
        <footer className="mt-6 pt-4 border-t-[3px] border-[var(--ink)] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h3 className="font-display font-bold uppercase tracking-[-.005em] text-[20px] sm:text-[22px] leading-none">
              First Post Free.
            </h3>
            <p className="mt-1.5 font-mono text-[10px] tracking-[.14em] uppercase text-[var(--ink-2)] max-w-[4.4in]">
              Show up five minutes early &middot; tell the PAX your name &middot;
              fall in. Rain or shine, free of charge, every week.
            </p>
          </div>
          <div className="sm:text-right shrink-0">
            <p className="font-mono text-[9px] tracking-[.22em] uppercase text-[var(--muted)]">
              // join us
            </p>
            <p className="font-display font-bold uppercase tracking-[.04em] text-[18px] leading-none mt-1">
              f3marietta.com
            </p>
            <p className="font-mono text-[9px] tracking-[.18em] uppercase text-[var(--muted)] mt-1">
              /workouts
            </p>
          </div>
        </footer>
      </article>

      <div className="no-print py-8 text-center">
        <p className="font-mono text-[11px] tracking-[.18em] uppercase text-[var(--muted)]">
          Cmd+P / Ctrl+P → Save as PDF
        </p>
      </div>
    </main>
  );
}
