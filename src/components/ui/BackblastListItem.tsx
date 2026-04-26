import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { excerptFromEvent } from "@/lib/backblast/getBackblastsPaginated";
import { getBackblastImage } from "@/lib/backblast/getBackblastImage";
import type { F3EventRow } from "@/lib/backblast/getBackblastsPaginated";

type Props = {
  item: F3EventRow;
  className?: string;
  /** `compact` = 88x88 thumbnail (home rail). `expanded` = large photo left rail (listing page). */
  variant?: "compact" | "expanded";
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function BackblastListItem({ item, className = "", variant = "compact" }: Props) {
  const title = item.title ?? "Backblast";
  const excerpt = excerptFromEvent(item, variant === "expanded" ? 220 : 140);
  const photo = getBackblastImage(item.id, item.image_url);

  if (variant === "expanded") {
    return (
      <Link
        href={`/backblasts/${item.id}`}
        className={`group block overflow-hidden border border-line-soft bg-bone transition-colors hover:bg-bone-2 ${className}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] items-stretch">
          {/* Photo rail */}
          <div className="relative bg-ink aspect-[4/3] md:aspect-auto md:h-full md:min-h-[220px] overflow-hidden">
            <Image
              src={photo}
              alt={item.image_url ? `Backblast photo — ${item.ao_display_name ?? "F3 Marietta"}` : ""}
              aria-hidden={item.image_url ? undefined : true}
              fill
              sizes="(min-width: 768px) 280px, 100vw"
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          </div>

          {/* Text column */}
          <div className="p-7 md:p-9 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusChip variant="active">{item.ao_display_name ?? "F3 Marietta"}</StatusChip>
              <MonoTag>{formatDate(item.event_date)}</MonoTag>
              {item.q_name && <MonoTag>Q · {item.q_name}</MonoTag>}
              {item.pax_count != null && <MonoTag>PAX · {item.pax_count}</MonoTag>}
            </div>
            <h3 className="font-display font-bold uppercase text-[clamp(22px,2.4vw,32px)] tracking-[-.01em] leading-tight">{title}</h3>
            {excerpt && <p className="mt-3 text-[14px] leading-[1.6] text-muted line-clamp-3 md:line-clamp-4">{excerpt}</p>}
            <div className="mt-5 flex items-center justify-end text-steel font-mono text-[11px] tracking-[.15em] uppercase opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
              Read report →
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // compact (home rail + anywhere else space-constrained)
  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`group flex items-stretch gap-5 border-b border-line-soft p-5 transition-colors hover:bg-bone-2 ${className}`}
    >
      <div className="relative flex-shrink-0 w-[88px] h-[88px] overflow-hidden bg-ink">
        <Image
          src={photo}
          alt=""
          aria-hidden="true"
          fill
          sizes="88px"
          className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
        />
      </div>

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
