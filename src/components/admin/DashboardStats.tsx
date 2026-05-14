import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Props = {
  totalPosts: number;
  uniquePax: number;
  newFngs: number;
  aoCount: number;
};

export function DashboardStats({ totalPosts, uniquePax, newFngs, aoCount }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <Stat
        tag="// total posts ytd"
        value={totalPosts}
        sub={aoCount === 1 ? "across 1 AO" : `across ${aoCount} AOs`}
      />
      <Stat
        tag="// new fngs ytd"
        value={newFngs}
        sub="parsed from backblast FNG: lines"
      />
      <Stat
        tag="// unique pax ytd"
        value={uniquePax}
        sub="posted at least once this year"
      />
    </div>
  );
}

function Stat({ tag, value, sub }: { tag: string; value: number; sub: string }) {
  return (
    <ClipFrame padding="p-5" className="min-h-[120px]">
      <MonoTag>{tag}</MonoTag>
      <div className="font-display text-[68px] leading-[.95] tracking-[-.01em] mt-2">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[11px] text-muted mt-2">{sub}</div>
    </ClipFrame>
  );
}
