import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { excerptFromEvent } from "@/lib/backblast/getBackblastsPaginated";
import { getBackblastImage } from "@/lib/backblast/getBackblastImage";
import type { F3EventRow } from "@/lib/backblast/getBackblastsPaginated";

type Props = { item: F3EventRow; className?: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function BackblastFeatureCard({ item, className = "" }: Props) {
  const title = item.title ?? "Backblast";
  const excerpt = excerptFromEvent(item, 220);
  const photo = getBackblastImage(item.id);

  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`relative block bg-ink text-bone overflow-hidden border border-ink-3 p-11 min-h-[520px] group ${className}`}
    >
      {/* Hero photo */}
      <Image
        src={photo}
        alt=""
        aria-hidden="true"
        fill
        className="object-cover opacity-[.32] group-hover:opacity-[.42] transition-opacity duration-500"
        sizes="(min-width: 1024px) 60vw, 100vw"
        priority={false}
      />
      {/* Legibility gradient — dark at top-left where text sits */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(115deg, rgba(10,13,18,.92) 0%, rgba(10,13,18,.78) 45%, rgba(10,13,18,.45) 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col h-full">
        <MonoTag variant="steel">{`${formatDate(item.event_date)} · ${item.ao_display_name ?? "F3 Marietta"}`}</MonoTag>
        <h3 className="mt-5 font-display font-bold uppercase text-[clamp(36px,4vw,56px)] leading-[.92] tracking-[-.01em] max-w-[580px]">
          {title}
        </h3>
        {excerpt && <p className="mt-6 text-[16px] leading-[1.55] text-bone/85 max-w-[580px]">{excerpt}</p>}
        <div className="mt-auto pt-6 border-t border-bone/20 flex flex-wrap gap-6 font-mono text-[11px] tracking-[.15em] uppercase text-bone/80">
          {item.q_name && <span>Q · {item.q_name}</span>}
          {item.pax_count != null && <span>PAX · {item.pax_count}</span>}
        </div>
      </div>
    </Link>
  );
}
