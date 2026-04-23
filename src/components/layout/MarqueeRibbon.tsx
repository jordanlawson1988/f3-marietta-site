type Variant = "primary" | "secondary";

type Props = {
  variant?: Variant;
  tokens?: string[];
  className?: string;
};

const DEFAULT_TOKENS = [
  "FITNESS", "FELLOWSHIP", "FAITH", "RAIN OR SHINE", "PEER-LED", "FREE OF CHARGE",
];

export function MarqueeRibbon({ variant = "primary", tokens = DEFAULT_TOKENS, className = "" }: Props) {
  const doubled = [...tokens, ...tokens, ...tokens, ...tokens];
  return (
    <div className={`w-full bg-ink overflow-hidden ${className}`}>
      <div
        className="inline-flex items-center whitespace-nowrap py-3.5"
        style={{ animation: `marquee-scroll 40s linear infinite` }}
      >
        {doubled.map((t, i) => (
          <span
            key={i}
            className={`font-display font-semibold uppercase tracking-[.15em] text-[18px] px-8 ${
              i % 3 === 2 ? "text-steel" : "text-bone"
            }`}
          >
            {t}
            <span className="inline-block w-1.5 h-1.5 rounded-full mx-4 align-middle" style={{ backgroundColor: i % 3 === 2 ? "var(--steel)" : "var(--bone)" }} />
          </span>
        ))}
      </div>
    </div>
  );
}
