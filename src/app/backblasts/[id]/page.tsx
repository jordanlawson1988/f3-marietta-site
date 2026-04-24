import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { excerptFromEvent } from "@/lib/backblast/getBackblastsPaginated";
import { getBackblastImage } from "@/lib/backblast/getBackblastImage";
import type { F3Event } from "@/types/f3Event";

type Params = Promise<{ id: string }>;

async function getEvent(id: string): Promise<F3Event | null> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM f3_events WHERE id = ${id} AND is_deleted = false LIMIT 1`;
    return (rows[0] as F3Event | undefined) ?? null;
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(
    typeof iso === "string" && !iso.includes("T") ? iso + "T00:00:00" : iso
  );
  return d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const evt = await getEvent(id);
  if (!evt) return { title: "Backblast" };
  return {
    title: evt.title ?? "Backblast",
    description: evt.content_text?.slice(0, 140) ?? undefined,
  };
}

export default async function BackblastDetail({ params }: { params: Params }) {
  const { id } = await params;
  const evt = await getEvent(id);
  if (!evt) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`${formatDate(evt.event_date)} · ${evt.ao_display_name ?? "F3 Marietta"}${evt.q_name ? ` · Q · ${evt.q_name}` : ""}`}
        variant="ink"
        title={evt.title ?? "Backblast"}
        kicker={excerptFromEvent(evt, 180) || undefined}
        backgroundImage={getBackblastImage(evt.id)}
      />

      <article className="bg-bone py-16">
        <div className="max-w-[820px] mx-auto px-7">
          <div className="flex flex-wrap gap-x-10 gap-y-3 py-5 border-y border-line-soft mb-10">
            {evt.q_name && <MonoTag>Q · {evt.q_name}</MonoTag>}
            {evt.pax_count != null && <MonoTag>PAX · {evt.pax_count}</MonoTag>}
            {evt.event_time && <MonoTag>TIME · {evt.event_time}</MonoTag>}
            {evt.location_text && <MonoTag>LOC · {evt.location_text}</MonoTag>}
          </div>
          <div
            className="backblast-content prose prose-zinc max-w-none"
            dangerouslySetInnerHTML={{ __html: evt.content_html ?? "" }}
          />
          {!evt.content_html && evt.content_text && (
            <div className="whitespace-pre-wrap text-[16px] leading-[1.7]">
              {evt.content_text}
            </div>
          )}
        </div>
      </article>

      <section className="bg-bone-2 py-10 border-t border-line-soft">
        <div className="max-w-[820px] mx-auto px-7 flex items-center justify-between font-display font-semibold uppercase tracking-[.1em] text-[14px]">
          <Link href="/backblasts" className="text-ink hover:text-steel">
            ← Back to reports
          </Link>
          <Link href="/workouts" className="text-steel">
            Post tomorrow →
          </Link>
        </div>
      </section>

      <CTABand
        variant="steel"
        title={
          <>
            Every post
            <br />
            leaves a record.
          </>
        }
        kicker={<>Come to a workout. Write the next one.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
