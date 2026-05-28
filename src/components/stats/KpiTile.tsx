import Link from "next/link";
import type { ReactNode } from "react";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export type KpiDelta = {
  /** prior period absolute value (use null when unknown / out-of-program-window) */
  prior: number | null;
  /** label for prior comparison ("vs last 30d", "vs prior month") */
  label: string;
  /** if true, lower is better (e.g., gaps, no-shows); flips the green/red */
  inverse?: boolean;
};

type Props = {
  label: string;
  value: string | number;
  caption?: string;
  /** sparkline series — values get min/max-scaled */
  spark?: number[];
  /** show delta vs prior period when this is present and current value is numeric */
  delta?: KpiDelta;
  /** click target — wraps the whole tile */
  href?: string;
  /** when true, applies an emphasis treatment (ink background) */
  featured?: boolean;
};

function formatNumber(v: string | number): string {
  if (typeof v === "number") return v.toLocaleString();
  return v;
}

function deltaPct(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 80;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-6 mt-2"
      role="img"
      aria-label="Trend sparkline"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function DeltaBadge({
  current,
  delta,
}: {
  current: number;
  delta: KpiDelta;
}) {
  if (delta.prior === null) {
    return (
      <span
        className="font-mono text-[10px] tracking-[.12em] uppercase text-muted"
        title="No prior-period data to compare"
      >
        — {delta.label}
      </span>
    );
  }
  const pct = deltaPct(current, delta.prior);
  if (pct === null) {
    return (
      <span className="font-mono text-[10px] tracking-[.12em] uppercase text-muted">
        new · {delta.label}
      </span>
    );
  }
  const rounded = Math.round(pct);
  const isFlat = Math.abs(rounded) < 1;
  const positive = rounded > 0;
  const goodDirection = delta.inverse ? !positive : positive;
  const color = isFlat
    ? "text-muted"
    : goodDirection
      ? "text-emerald-700"
      : "text-rose-700";
  const arrow = isFlat ? "→" : positive ? "↑" : "↓";
  const sign = isFlat ? "" : positive ? "+" : "";
  return (
    <span
      className={`font-mono text-[10px] tracking-[.12em] uppercase ${color}`}
      title={`Prior period: ${delta.prior.toLocaleString()}`}
    >
      {arrow} {sign}
      {rounded}% {delta.label}
    </span>
  );
}

function TileBody({
  label,
  value,
  caption,
  spark,
  delta,
  featured,
}: Omit<Props, "href">) {
  const displayValue = formatNumber(value);
  const isNumeric = typeof value === "number";
  const variant = featured ? "ink" : "bone";
  return (
    <ClipFrame
      padding="p-5"
      variant={variant}
      className="min-h-[140px] h-full flex flex-col"
    >
      <MonoTag variant={featured ? "bone" : "muted"}>// {label}</MonoTag>
      <p
        className={`font-display font-black uppercase text-[40px] tracking-[-.02em] mt-2 leading-none ${
          featured ? "text-bone" : "text-ink"
        }`}
      >
        {displayValue}
      </p>
      <div
        className={`flex items-center justify-between gap-2 mt-2 ${
          featured ? "text-bone/70" : ""
        }`}
      >
        {caption ? (
          <span className="font-mono text-[10px] text-muted">// {caption}</span>
        ) : (
          <span aria-hidden />
        )}
      </div>
      <div className="mt-auto pt-2">
        {delta && isNumeric && (
          <DeltaBadge current={value as number} delta={delta} />
        )}
        {spark && spark.length >= 2 && <Sparkline data={spark} />}
      </div>
    </ClipFrame>
  );
}

export function KpiTile({ href, ...rest }: Props): ReactNode {
  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-label={`Open ${rest.label} detail`}
        className="block focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink transition-opacity hover:opacity-90"
      >
        <TileBody {...rest} />
      </Link>
    );
  }
  return <TileBody {...rest} />;
}
