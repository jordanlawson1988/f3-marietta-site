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
      className="inline-block bg-foreground text-background font-mono text-xs px-4 py-2 hover:opacity-90"
    >
      {label}
    </a>
  );
}
