import Link from "next/link";
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
        href="/admin/analytics"
        ariaLabel="Drill into total posts in the analytics view"
      />
      <Stat
        tag="// new fngs ytd"
        value={newFngs}
        sub="parsed from backblast FNG: lines"
        href="/admin/analytics/fngs"
        ariaLabel="Drill into the FNG roster"
      />
      <Stat
        tag="// unique pax ytd"
        value={uniquePax}
        sub="posted at least once this year"
        href="/admin/analytics?topN=all"
        ariaLabel="Drill into the full PAX leaderboard"
      />
    </div>
  );
}

function Stat({
  tag,
  value,
  sub,
  href,
  ariaLabel,
}: {
  tag: string;
  value: number;
  sub: string;
  href?: string;
  ariaLabel?: string;
}) {
  const body = (
    <ClipFrame
      padding="p-5"
      className={`min-h-[120px] ${href ? "transition-colors hover:bg-black/5" : ""}`}
    >
      <MonoTag>{tag}</MonoTag>
      <div className="font-display text-[68px] leading-[.95] tracking-[-.01em] mt-2">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[11px] text-muted mt-2">{sub}</div>
      {href && (
        <div className="font-mono text-[10px] text-muted/70 mt-1">// drill →</div>
      )}
    </ClipFrame>
  );
  if (href) {
    return (
      <Link href={href} className="block" aria-label={ariaLabel} prefetch={false}>
        {body}
      </Link>
    );
  }
  return body;
}
