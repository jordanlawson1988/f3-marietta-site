import { CTABand } from "@/components/ui/brand/CTABand";

export function JoinCTASection() {
  return (
    <CTABand
      variant="gradient"
      id="new"
      title={<>Post.<br />That&apos;s it.</>}
      kicker={
        <>
          No sign-up. No fee. No catch. Show up five minutes early, tell us your name, and fall in. We&apos;ll handle the rest.
        </>
      }
      primary={{ label: "Plan Your First Post", href: "/new-here" }}
      watermark={
        <span className="absolute -bottom-16 right-0 font-display font-bold uppercase text-bone text-[clamp(200px,30vw,480px)] leading-none">
          05:15
        </span>
      }
    />
  );
}
