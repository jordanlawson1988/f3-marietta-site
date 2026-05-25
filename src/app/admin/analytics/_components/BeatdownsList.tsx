import Link from "next/link";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import type { BeatdownRow } from "@/lib/stats/getBeatdownsList";

type Props = {
  data: BeatdownRow[];
};

function joinQs(qs: string[]): string {
  if (qs.length === 0) return "—";
  if (qs.length <= 2) return qs.join(", ");
  return `${qs.slice(0, 2).join(", ")} +${qs.length - 2}`;
}

export function BeatdownsList({ data }: Props) {
  return (
    <ClipFrame padding="p-6" className="min-h-[180px]">
      <MonoTag>// beatdowns &middot; {data.length}</MonoTag>
      {data.length === 0 ? (
        <p className="font-mono text-xs text-muted mt-3">
          // no beatdowns in range
        </p>
      ) : (
        <>
          <div
            role="row"
            className="font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft pb-1.5 mt-4 flex items-baseline gap-3"
          >
            <span className="w-24 shrink-0">date</span>
            <span className="w-32 shrink-0">AO</span>
            <span className="flex-1">beatdown</span>
            <span className="w-32 shrink-0">Q</span>
            <span className="w-14 shrink-0 text-right">HC</span>
            <span className="w-14 shrink-0 text-right">PAX</span>
            <span className="w-14 shrink-0 text-right">FNG</span>
          </div>
          <ul className="font-mono text-xs mt-2 space-y-0.5">
            {data.map((row) => (
              <li key={row.eventId}>
                <Link
                  href={`/backblasts/${row.eventId}`}
                  className="flex items-baseline gap-3 -mx-2 px-2 py-1.5 text-ink hover:bg-ink/10 transition-colors"
                  title={`Open backblast — ${row.aoName}${
                    row.qNames.length > 0 ? ` · Q ${row.qNames.join(", ")}` : ""
                  }`}
                >
                  <span className="w-24 shrink-0 text-muted">{row.eventDate}</span>
                  <span className="w-32 shrink-0 truncate text-muted">{row.aoName}</span>
                  <span className="flex-1 truncate">{row.beatdownTitle ?? "—"}</span>
                  <span className="w-32 shrink-0 truncate text-muted">
                    {joinQs(row.qNames)}
                  </span>
                  <span className="w-14 shrink-0 text-right text-muted">
                    {row.headcount ?? "—"}
                  </span>
                  <span className="w-14 shrink-0 text-right text-muted">
                    {row.paxCount || "—"}
                  </span>
                  <span className="w-14 shrink-0 text-right text-muted">
                    {row.fngCount || "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </ClipFrame>
  );
}
