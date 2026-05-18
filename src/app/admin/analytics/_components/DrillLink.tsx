import Link from "next/link";
import type { ReactNode } from "react";

export function DrillLink({
  href,
  children,
  className,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} className={className} aria-label={ariaLabel} prefetch={false}>
      {children}
    </Link>
  );
}
