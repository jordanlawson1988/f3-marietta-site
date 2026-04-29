import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "steel" | "ink" | "bone" | "ghost";
type Size = "sm" | "md" | "lg";

type BaseProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
};

type LinkProps = BaseProps & { href: string; onClick?: never; type?: never };
type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type Props = LinkProps | ButtonProps;

const variantClass: Record<Variant, string> = {
  steel: "bg-steel text-bone border-steel hover:bg-steel-2 hover:border-steel-2",
  ink:   "bg-ink text-bone border-ink hover:bg-steel hover:border-steel",
  bone:  "bg-bone text-ink border-ink hover:bg-ink hover:text-bone",
  ghost: "bg-transparent text-bone border-bone/30 hover:border-bone clip-chamfer-none",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[12px]",
  md: "px-5 py-3 text-[13px]",
  lg: "px-7 py-4 text-[15px]",
};

export function ChamferButton(props: Props) {
  const { children, variant = "steel", size = "md", arrow = true, className = "" } = props;
  const clip = variant === "ghost" ? "" : "clip-chamfer";
  const base = `inline-flex items-center gap-2.5 border-[1.5px] font-display font-semibold uppercase tracking-[.1em] transition-all duration-200 ${variantClass[variant]} ${sizeClass[size]} ${clip} ${className}`;

  const content = (
    <>
      {children}
      {arrow && <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>}
    </>
  );

  if ("href" in props && props.href) {
    return <Link href={props.href} className={`group ${base}`}>{content}</Link>;
  }
  const {
    href: _href,
    children: _children,
    variant: _variant,
    size: _size,
    arrow: _arrow,
    className: _className,
    ...buttonProps
  } = props as ButtonProps;
  return <button {...buttonProps} className={`group ${base}`}>{content}</button>;
}
