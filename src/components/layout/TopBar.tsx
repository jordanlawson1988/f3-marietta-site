import { PulseDot } from "@/components/ui/brand/PulseDot";
import { getNextMarietteMuster } from "@/lib/stats/getNextMarietteMuster";

export async function TopBar() {
  const muster = await getNextMarietteMuster();
  return (
    <div className="w-full bg-ink text-bone border-b border-ink-3">
      <div className="max-w-[1320px] mx-auto flex justify-between items-center gap-4 px-5 sm:px-7 py-2 font-mono text-[11px] tracking-[.08em] uppercase">
        <div className="flex items-center min-w-0">
          <PulseDot variant="rust" className="mr-2 shrink-0" />
          {/* Long copy on desktop; tight muster-only label on mobile so the
              bar never wraps to a second line. */}
          <span className="opacity-70 hidden sm:inline truncate">
            Gloom Status: Active · Next Muster {muster}
          </span>
          <span className="opacity-70 sm:hidden truncate">
            Next Muster · {muster}
          </span>
        </div>
        <div className="hidden md:flex gap-5 opacity-70 shrink-0">
          <span>Marietta, GA</span>
          <span>Est. 2024 · Region 2025</span>
          <a
            href="https://f3nation.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-100 hover:underline underline-offset-2 transition-opacity"
          >
            F3 Nation
          </a>
        </div>
      </div>
    </div>
  );
}
