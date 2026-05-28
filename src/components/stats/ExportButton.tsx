export function ExportButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 bg-ink text-bone font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2.5 hover:opacity-90 transition-opacity"
    >
      <span aria-hidden>↓</span>
      {label}
    </a>
  );
}
