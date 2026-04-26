import Link from "next/link";
import { PulseDot } from "@/components/ui/brand/PulseDot";
import { getNextMarietteMuster } from "@/lib/stats/getNextMarietteMuster";

export async function TopBar() {
  const muster = await getNextMarietteMuster();
  const aoLabelCompact = muster.aoName.replace(/^The\s+/, "");

  return (
    <div className="w-full bg-ink text-bone border-b border-ink-3">
      <div className="max-w-[1320px] mx-auto flex justify-between items-center gap-4 px-5 sm:px-7 py-2 font-mono text-[11px] tracking-[.08em] uppercase">
        <Link
          href={muster.href}
          aria-label={`Next muster: ${muster.combinedLabel} at ${muster.aoName}`}
          className="flex items-center min-w-0 hover:opacity-100 transition-opacity"
        >
          <PulseDot variant="rust" className="mr-2 shrink-0" />
          {/* Mobile: tight muster + AO line so the bar never wraps.
              Desktop: full "Gloom Status" prefix + AO. */}
          <span className="opacity-70 hover:opacity-100 transition-opacity hidden sm:inline truncate">
            Gloom Status: Active · Next Muster {muster.combinedLabel} ·{" "}
            <span className="text-bone">{muster.aoName}</span>
            <span aria-hidden="true" className="ml-1.5">→</span>
          </span>
          <span className="opacity-70 hover:opacity-100 transition-opacity sm:hidden truncate">
            Next · {muster.combinedLabel} ·{" "}
            <span className="text-bone">{aoLabelCompact}</span>
            <span aria-hidden="true" className="ml-1">→</span>
          </span>
        </Link>
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
