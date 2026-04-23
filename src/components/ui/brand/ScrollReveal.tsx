"use client";

import { useEffect, useRef, type ReactNode, type ElementType } from "react";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  threshold?: number;
  delayMs?: number;
};

export function ScrollReveal({
  children,
  as: Component = "div",
  className = "",
  threshold = 0.12,
  delayMs = 0,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delayMs) {
              window.setTimeout(() => entry.target.classList.add("in"), delayMs);
            } else {
              entry.target.classList.add("in");
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, delayMs]);

  return (
    <Component ref={ref} className={`reveal ${className}`}>
      {children}
    </Component>
  );
}
