import Link from "next/link";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Row = {
  eventDate: string;
  aoName: string;
  aoSlug: string;
  headcount: number | null;
};

export function QdWorkoutsTable({
  data,
  aoHref,
}: {
  data: Row[];
  aoHref?: (aoSlug: string) => string;
}) {
  return (
    <ClipFrame padding="p-6" className="min-h-[180px]">
      <MonoTag>// workouts q&apos;d · {data.length}</MonoTag>
      {data.length === 0 ? (
        <p className="font-mono text-xs text-muted mt-3">
          // no Q records in range
        </p>
      ) : (
        <>
          <div
            role="row"
            className="font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft pb-1.5 mt-4 flex items-baseline gap-3"
          >
            <span className="w-24">date</span>
            <span className="flex-1">AO</span>
            <span className="w-12 text-right" title="PAX headcount at this workout">
              pax
            </span>
          </div>
          <ul className="font-mono text-xs mt-2 space-y-1">
            {data.map((r) => {
              const href = aoHref?.(r.aoSlug);
              return (
                <li
                  key={`${r.eventDate}-${r.aoSlug}`}
                  className="flex items-baseline gap-3"
                >
                  <span className="w-24 text-muted">{r.eventDate}</span>
                  {href ? (
                    <Link
                      href={href}
                      className="flex-1 truncate hover:text-ink underline-offset-4 hover:underline transition-colors"
                    >
                      {r.aoName}
                    </Link>
                  ) : (
                    <span className="flex-1 truncate">{r.aoName}</span>
                  )}
                  <span className="w-12 text-right text-muted">
                    {r.headcount ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ClipFrame>
  );
}
