import { PulseDot } from "@/components/ui/brand/PulseDot";

function nextMusterLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const daysMap: Record<number, string> = { 1: "MON 05:15", 2: "TUE 05:15", 3: "WED 05:15", 4: "THU 05:15", 5: "FRI 05:15", 6: "SAT 07:00", 0: "MON 05:15" };
  const musterDays = [1, 2, 3, 4, 5, 6];
  const hour = now.getHours();
  if (musterDays.includes(day) && hour < 5) return daysMap[day];
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (musterDays.includes(d === 0 ? 7 : d)) return daysMap[d === 0 ? 7 : d];
  }
  return "MON 05:15";
}

export function TopBar() {
  const muster = nextMusterLabel();
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
