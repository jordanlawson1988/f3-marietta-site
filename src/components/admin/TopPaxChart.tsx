import Link from "next/link";
import { Fragment } from "react";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import type { PaxRanking } from "@/lib/stats/resolvePaxIdentity";

export function TopPaxChart({
  data,
  topN,
  href,
}: {
  data: PaxRanking[];
  // undefined sentinel = render the entire ranked list (URL "all" case).
  topN?: number;
  href?: (paxKey: string) => string;
}) {
  const visible = topN === undefined ? data : data.slice(0, topN);
  const label = topN === undefined ? "all" : String(topN);

  if (visible.length === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[260px]">
        <MonoTag>{`// top posters · top ${label}`}</MonoTag>
        <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
          Top PAX
        </h3>
        <p className="font-mono text-xs text-muted">// no posts yet this year</p>
      </ClipFrame>
    );
  }

  const max = visible[0].count;

  return (
    <ClipFrame padding="p-6" className="min-h-[260px]">
      <MonoTag>{`// top posters · top ${label}`}</MonoTag>
      <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
        Top PAX
      </h3>
      <ul className="font-mono text-xs space-y-1.5">
        {visible.map((p) => {
          const widthPct = max === 0 ? 0 : Math.max(2, (p.count / max) * 100);
          const row = (
            <li className="grid grid-cols-[130px_1fr_40px] items-center gap-3">
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
          if (href) {
            return (
              <Link
                key={p.key}
                href={href(p.key)}
                className="block hover:bg-black/5"
                prefetch={false}
              >
                {row}
              </Link>
            );
          }
          return <Fragment key={p.key}>{row}</Fragment>;
        })}
      </ul>
    </ClipFrame>
  );
}
