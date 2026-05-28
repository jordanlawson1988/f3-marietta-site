import { MonoTag } from "@/components/ui/brand/MonoTag";

type Props = {
  sentence: string;
  /** small mono prefix label, e.g. "// insight" */
  eyebrow?: string;
};

export function InsightHeadline({ sentence, eyebrow = "5-second read" }: Props) {
  return (
    <div className="mb-6 p-5 border border-line-soft bg-bone-2/60">
      <MonoTag>// {eyebrow}</MonoTag>
      <p className="font-display font-medium text-[20px] leading-tight tracking-[-.01em] text-ink mt-2">
        {sentence}
      </p>
    </div>
  );
}
