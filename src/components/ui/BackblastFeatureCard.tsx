import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { createExcerpt } from "@/lib/backblast/getBackblastsPaginated";
import type { F3EventRow } from "@/lib/backblast/getBackblastsPaginated";

type Props = { item: F3EventRow; className?: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function BackblastFeatureCard({ item, className = "" }: Props) {
  const title = item.title ?? "Battlefield Report";
  const excerpt = createExcerpt(item.content_text, 220);

  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`relative block bg-ink text-bone overflow-hidden border border-ink-3 p-11 min-h-[520px] group ${className}`}
    >
      <Image
        src="/icons/f3mariettalogo-main.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={400}
        className="absolute -bottom-20 -right-20 opacity-[.08] pointer-events-none"
        style={{ filter: "invert(1)" }}
      />
      <div className="relative z-10 flex flex-col h-full">
        <MonoTag variant="steel">{`${formatDate(item.event_date)} · ${item.ao_display_name ?? "F3 Marietta"}`}</MonoTag>
        <h3 className="mt-5 font-display font-bold uppercase text-[clamp(36px,4vw,56px)] leading-[.92] tracking-[-.01em] max-w-[580px]">
          {title}
        </h3>
        {excerpt && <p className="mt-6 text-[16px] leading-[1.55] text-bone/75 max-w-[580px]">{excerpt}</p>}
        <div className="mt-auto pt-6 border-t border-bone/12 flex flex-wrap gap-6 font-mono text-[11px] tracking-[.15em] uppercase text-bone/70">
          {item.q_name && <span>Q · {item.q_name}</span>}
          {item.pax_count != null && <span>PAX · {item.pax_count}</span>}
        </div>
      </div>
    </Link>
  );
}
