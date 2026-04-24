import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { excerptFromEvent } from "@/lib/backblast/getBackblastsPaginated";
import { getBackblastImage } from "@/lib/backblast/getBackblastImage";
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
  const photo = getBackblastImage(item.id);
  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`group flex items-stretch gap-5 border-b border-line-soft p-5 transition-colors hover:bg-bone-2 ${className}`}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-[88px] h-[88px] overflow-hidden bg-ink">
        <Image
          src={photo}
          alt=""
          aria-hidden="true"
          fill
          sizes="88px"
          className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Text column */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <StatusChip variant="active">{item.ao_display_name ?? "F3 Marietta"}</StatusChip>
          <MonoTag>{formatDate(item.event_date)}</MonoTag>
          {item.q_name && <MonoTag>Q · {item.q_name}</MonoTag>}
        </div>
        <h4 className="font-display font-bold uppercase text-[19px] tracking-[-.01em] leading-tight truncate">{title}</h4>
        {excerpt && <p className="mt-1.5 text-[13px] leading-[1.55] text-muted line-clamp-2">{excerpt}</p>}
        <div className="mt-2 flex items-center justify-end text-steel font-mono text-[11px] tracking-[.15em] uppercase opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
          Read report →
        </div>
      </div>
    </Link>
  );
}
