import { PulseDot } from "@/components/ui/brand/PulseDot";
import { getNextMarietteMuster } from "@/lib/stats/getNextMarietteMuster";

export async function TopBar() {
  const muster = await getNextMarietteMuster();
  return (
    <div className="w-full bg-ink text-bone border-b border-ink-3">
      <div className="max-w-[1320px] mx-auto flex justify-between items-center gap-6 px-7 py-2 font-mono text-[11px] tracking-[.08em] uppercase">
        <div className="flex items-center">
          <PulseDot variant="rust" className="mr-2" />
          <span className="opacity-70">Gloom Status: Active · Next Muster {muster}</span>
        </div>
        <div className="hidden md:flex gap-5 opacity-70">
          <span>Marietta, GA</span>
          <span>Est. 2024 · Region 2025</span>
          <span>F3 Nation</span>
        </div>
      </div>
    </div>
  );
}
