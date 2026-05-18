import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption?: string;
}) {
  return (
    <ClipFrame padding="p-5" className="min-h-[120px]">
      <MonoTag>// {label}</MonoTag>
      <p className="font-display font-black uppercase text-[40px] tracking-[-.02em] mt-2 leading-none">
        {value}
      </p>
      {caption && (
        <p className="font-mono text-[10px] text-muted mt-1">// {caption}</p>
      )}
    </ClipFrame>
  );
}
