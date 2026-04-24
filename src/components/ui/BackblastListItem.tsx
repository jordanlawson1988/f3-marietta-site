import Link from "next/link";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { excerptFromEvent } from "@/lib/backblast/getBackblastsPaginated";
import type { F3EventRow } from "@/lib/backblast/getBackblastsPaginated";

type Props = { item: F3EventRow; className?: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function BackblastListItem({ item, className = "" }: Props) {
  const title = item.title ?? "Backblast";
  const excerpt = excerptFromEvent(item, 140);
  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`group block border-b border-line-soft p-6 transition-colors hover:bg-bone-2 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <StatusChip variant="active">{item.ao_display_name ?? "F3 Marietta"}</StatusChip>
        <MonoTag>{formatDate(item.event_date)}</MonoTag>
        {item.q_name && <MonoTag>Q · {item.q_name}</MonoTag>}
      </div>
      <h4 className="font-display font-bold uppercase text-[20px] tracking-[-.01em] leading-tight">{title}</h4>
      {excerpt && <p className="mt-2 text-[13px] leading-[1.55] text-muted">{excerpt}</p>}
      <div className="mt-3 flex items-center justify-end text-steel font-mono text-[11px] tracking-[.15em] uppercase opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
        Read report →
      </div>
    </Link>
  );
}
