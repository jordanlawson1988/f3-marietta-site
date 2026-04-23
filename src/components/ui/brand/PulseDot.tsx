type Props = {
  variant?: "rust" | "steel";
  className?: string;
};

export function PulseDot({ variant = "rust", className = "" }: Props) {
  const bg = variant === "steel" ? "bg-steel" : "bg-rust";
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-1.5 h-1.5 rounded-full ${bg} ${className}`}
      style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
    />
  );
}
