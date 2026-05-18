import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export default function Loading() {
  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <div className="font-mono text-xs text-muted mb-10">// loading…</div>
      <ClipFrame padding="p-5" className="mb-6">
        <MonoTag>// filters</MonoTag>
        <div className="h-8 mt-3 bg-black/5 animate-pulse" />
      </ClipFrame>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <ClipFrame key={i} padding="p-5" className="min-h-[120px]">
            <div className="h-4 bg-black/5 animate-pulse mb-3" />
            <div className="h-10 bg-black/5 animate-pulse" />
          </ClipFrame>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <ClipFrame padding="p-6" className="min-h-[260px]">
            <div className="h-full bg-black/5 animate-pulse" />
          </ClipFrame>
        </div>
        <div className="md:col-span-7">
          <ClipFrame padding="p-6" className="min-h-[260px]">
            <div className="h-full bg-black/5 animate-pulse" />
          </ClipFrame>
        </div>
      </div>
    </section>
  );
}
