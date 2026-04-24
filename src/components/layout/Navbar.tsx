"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";

const NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Workouts", href: "/workouts" },
  { name: "Backblasts", href: "/backblasts" },
  { name: "New Here", href: "/new-here" },
  { name: "Contact", href: "/contact" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[color:var(--line-soft)] backdrop-blur-md"
      style={{ background: "rgba(241,236,225,.92)" }}>
      <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-6 px-7 py-3.5">
        <Link href="/" className="flex items-center gap-3.5 group">
          <Image
            src="/images/new-f3-marietta-logo.png"
            alt="F3 Marietta cannon emblem"
            width={56}
            height={56}
            priority
            className="h-14 w-14 rounded-full object-cover border-[1.5px] border-ink"
          />
          <div className="hidden sm:flex flex-col gap-1 leading-none">
            <span className="font-display font-bold uppercase tracking-[.06em] text-[20px]">F3 Marietta</span>
            <span className="font-mono text-[10px] tracking-[.18em] uppercase text-muted">Fitness · Fellowship · Faith</span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`relative px-3.5 py-2.5 font-display font-semibold uppercase tracking-[.06em] text-[13px] transition-colors ${
                      active ? "text-steel" : "text-ink hover:text-steel"
                    }`}
                  >
                    {item.name}
                    {active && <span className="absolute left-3.5 right-3.5 bottom-1 h-[2px] bg-steel" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <ChamferButton href="/workouts" variant="ink" size="sm" className="ml-2">
            Find a Workout
          </ChamferButton>
        </nav>

        <button
          className="lg:hidden p-2 text-ink"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-ink text-bone">
          <ul className="max-w-[1320px] mx-auto flex flex-col px-7 py-5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-3 font-display font-semibold uppercase tracking-[.08em] text-[15px] border-b border-ink-3"
                >
                  {item.name}
                </Link>
              </li>
            ))}
            <li className="pt-4">
              <ChamferButton href="/workouts" variant="steel" size="md" className="w-full justify-center">
                Find a Workout
              </ChamferButton>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
