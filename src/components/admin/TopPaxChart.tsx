import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import type { PaxRanking } from "@/lib/stats/resolvePaxIdentity";

export function TopPaxChart({ data }: { data: PaxRanking[] }) {
  if (data.length === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[260px]">
        <MonoTag>// top posters · top 20 ytd</MonoTag>
        <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
          Top PAX
        </h3>
        <p className="font-mono text-xs text-muted">// no posts yet this year</p>
      </ClipFrame>
    );
  }

  const max = data[0].count;

  return (
    <ClipFrame padding="p-6" className="min-h-[260px]">
      <MonoTag>// top posters · top 20 ytd</MonoTag>
      <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
        Top PAX
      </h3>
      <ul className="font-mono text-xs space-y-1.5">
        {data.map((p) => {
          const widthPct = max === 0 ? 0 : Math.max(2, (p.count / max) * 100);
          return (
            <li
              key={p.key}
              className="grid grid-cols-[130px_1fr_40px] items-center gap-3"
            >
              <span className="truncate" title={p.label}>
                {p.label}
              </span>
              <span
                className="h-3.5 bg-ink block"
                style={{ width: `${widthPct}%` }}
                aria-hidden="true"
              />
              <span className="text-right">{p.count}</span>
            </li>
          );
        })}
      </ul>
    </ClipFrame>
  );
}
