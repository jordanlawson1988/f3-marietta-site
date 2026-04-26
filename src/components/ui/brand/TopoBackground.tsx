type Props = {
  variant?: "light" | "dark";
  className?: string;
};

export function TopoBackground({ variant = "light", className = "" }: Props) {
  const bg = variant === "dark" ? "bg-topo-dark" : "bg-topo-light";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${bg} ${className}`}
      style={{ opacity: 0.6 }}
    />
  );
}
