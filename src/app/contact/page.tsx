import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach F3 Marietta leadership for FNG questions, media inquiries, or AO plant interest.",
};

const CONTACTS = [
  { label: "General", email: "hello@f3marietta.com" },
  { label: "FNG Inquiries", email: "fng@f3marietta.com" },
  { label: "Media / Press", email: "press@f3marietta.com" },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ Connect"
        title={<>Find us.<br />Fall in.</>}
        kicker={<>Questions about posting, planting an AO, or joining the region? Reach out — we read everything.</>}
        meter={{ left: "Coordinates · 33.9526° N, 84.5499° W", right: "F3.MAR · REGION HQ" }}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <MonoTag>// Direct Lines</MonoTag>
            <div className="mt-5 grid gap-4">
              {CONTACTS.map((c) => (
                <ClipFrame key={c.email} padding="p-7" className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <MonoTag>{c.label}</MonoTag>
                    <div className="mt-1 font-display font-bold uppercase tracking-[.02em] text-[22px]">{c.email}</div>
                  </div>
                  <ChamferButton href={`mailto:${c.email}`} variant="ink" size="sm">Email</ChamferButton>
                </ClipFrame>
              ))}
            </div>
          </div>

          <form
            action={`mailto:hello@f3marietta.com`}
            method="POST"
            encType="text/plain"
            className="bg-bone-2 border border-line-soft p-8"
          >
            <MonoTag>// Send a Message</MonoTag>
            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Topic</span>
                <select name="topic" className="w-full border border-line-soft bg-transparent px-3 py-2 font-mono text-[13px] tracking-[.05em] uppercase focus:outline-none focus:border-ink">
                  <option>General</option>
                  <option>FNG Inquiry</option>
                  <option>Media</option>
                  <option>Plant an AO</option>
                </select>
              </label>
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Name</span>
                <input required name="name" className="w-full border border-line-soft bg-transparent px-3 py-2 focus:outline-none focus:border-ink" />
              </label>
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Email</span>
                <input required type="email" name="email" className="w-full border border-line-soft bg-transparent px-3 py-2 focus:outline-none focus:border-ink" />
              </label>
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Message</span>
                <textarea required name="message" rows={5} className="w-full border border-line-soft bg-transparent px-3 py-2 focus:outline-none focus:border-ink" />
              </label>
              <div className="pt-1">
                <ChamferButton type="submit" variant="ink" size="md">Send Message</ChamferButton>
              </div>
            </div>
          </form>
        </div>
      </section>

      <MarqueeRibbon />
    </>
  );
}
