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
  // Threshold MUST stay at 0 (any pixel visible triggers reveal). Anything
  // higher silently breaks for elements taller than the viewport: the max
  // possible intersectionRatio of an element taller than the root is
  // viewportHeight / elementHeight. On the /workouts page the WorkoutsFilter
  // wrapper is ~7700px tall on a ~660px iPhone — max ratio ~0.086, so a
  // 0.12 threshold could NEVER fire and every card stayed at opacity:0.
  threshold = 0,
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
