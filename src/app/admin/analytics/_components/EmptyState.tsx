import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export function EmptyState({ message }: { message: string }) {
  return (
    <ClipFrame padding="p-8" className="min-h-[180px]">
      <MonoTag>// no data</MonoTag>
      <p className="font-mono text-xs text-muted mt-3">// {message}</p>
    </ClipFrame>
  );
}
