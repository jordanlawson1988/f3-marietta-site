import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export function EmptyState({
  title = "no data",
  message,
  cta,
}: {
  title?: string;
  message: string;
  cta?: { label: string; href: string };
}) {
  return (
    <ClipFrame padding="p-8" className="min-h-[180px]">
      <MonoTag>// {title}</MonoTag>
      <p className="font-mono text-xs text-muted mt-3">// {message}</p>
      {cta && (
        <a
          href={cta.href}
          className="inline-block mt-4 font-mono text-[11px] tracking-[.15em] uppercase text-ink underline underline-offset-4"
        >
          {cta.label} →
        </a>
      )}
    </ClipFrame>
  );
}
