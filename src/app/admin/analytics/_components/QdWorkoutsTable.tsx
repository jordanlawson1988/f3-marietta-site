import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Row = {
  eventDate: string;
  aoName: string;
  aoSlug: string;
  headcount: number | null;
};

export function QdWorkoutsTable({ data }: { data: Row[] }) {
  return (
    <ClipFrame padding="p-6" className="min-h-[180px]">
      <MonoTag>// workouts q&apos;d · {data.length}</MonoTag>
      {data.length === 0 ? (
        <p className="font-mono text-xs text-muted mt-3">
          // no Q records in range
        </p>
      ) : (
        <ul className="font-mono text-xs mt-4 space-y-1">
          {data.map((r) => (
            <li
              key={`${r.eventDate}-${r.aoSlug}`}
              className="flex items-baseline gap-3"
            >
              <span className="w-24 text-muted">{r.eventDate}</span>
              <span className="flex-1 truncate">{r.aoName}</span>
              <span className="w-12 text-right text-muted">
                {r.headcount ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ClipFrame>
  );
}
