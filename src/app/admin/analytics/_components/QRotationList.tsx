import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export function QRotationList({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  return (
    <ClipFrame padding="p-6" className="min-h-[220px]">
      <MonoTag>// q rotation · in range</MonoTag>
      {data.length === 0 ? (
        <p className="font-mono text-xs text-muted mt-3">
          // no Q records in range (f3_event_qs has 85% coverage; older workouts may be missing)
        </p>
      ) : (
        <>
          <div
            role="row"
            className="font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft pb-1.5 mt-4 flex items-baseline gap-3"
          >
            <span className="flex-1">Q (pax)</span>
            <span className="w-8 text-right" title="workouts Q'd in this range">
              Q&apos;d
            </span>
          </div>
          <ul className="font-mono text-xs mt-2 space-y-1.5">
            {data.map((q) => (
              <li key={q.label} className="flex items-baseline gap-3">
                <span className="flex-1 truncate">{q.label}</span>
                <span className="w-8 text-right">{q.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ClipFrame>
  );
}
