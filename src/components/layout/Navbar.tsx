"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Facebook, Instagram } from "lucide-react";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { SOCIAL_LINKS } from "@/lib/socialLinks";

// ---------------------------------------------------------------------------
// Nav structure — flat items + grouped dropdowns
// ---------------------------------------------------------------------------

type NavLink = { name: string; href: string };
type NavDropdown = { name: string; children: NavLink[] };
type NavItem = NavLink | NavDropdown;

function isDropdown(item: NavItem): item is NavDropdown {
  return "children" in item;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/" },
  {
    name: "About",
    children: [
      { name: "About F3", href: "/about" },
      { name: "New Here", href: "/new-here" },
    ],
  },
  { name: "Workouts", href: "/workouts" },
  { name: "Backblasts", href: "/backblasts" },
  {
    name: "Resources",
    children: [
      { name: "F3 Terms", href: "/glossary" },
      { name: "FAQ", href: "/faq" },
      { name: "Beatdown Builder", href: "/beatdown-builder" },
    ],
  },
  { name: "Contact", href: "/contact" },
];

const FLAT_LINKS: NavLink[] = NAV_ITEMS.flatMap((item) =>
  isDropdown(item) ? item.children : [item]
);

const MENU_SOCIALS = [
  { id: "facebook", label: "Facebook", href: SOCIAL_LINKS.facebook, Icon: Facebook },
  { id: "instagram", label: "Instagram", href: SOCIAL_LINKS.instagram, Icon: Instagram },
];

// ---------------------------------------------------------------------------
// Desktop dropdown
// ---------------------------------------------------------------------------

function DesktopDropdown({
  item,
  isActive,
}: {
  item: NavDropdown;
  isActive: (href: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLLIElement>(null);

  const groupActive = item.children.some((c) => isActive(c.href));

  function enter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function leave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`relative flex items-center gap-1 px-3.5 py-2.5 font-display font-semibold uppercase tracking-[.06em] text-[13px] transition-colors ${
          groupActive ? "text-steel" : "text-ink hover:text-steel"
        }`}
      >
        {item.name}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
        {groupActive && (
          <span className="absolute left-3.5 right-3.5 bottom-1 h-[2px] bg-steel" aria-hidden="true" />
        )}
      </button>

      <div
        className={`absolute left-0 top-full pt-1 transition-all duration-150 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <ul
          className="min-w-[200px] border border-line-soft bg-bone shadow-md py-1"
          style={{ background: "rgba(241,236,225,.98)" }}
        >
          {item.children.map((child) => {
            const active = isActive(child.href);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={() => setOpen(false)}
                  className={`block px-5 py-3 font-display font-semibold uppercase tracking-[.06em] text-[12px] transition-colors ${
                    active ? "text-steel" : "text-ink hover:text-steel hover:bg-ink/[.04]"
                  }`}
                >
                  {child.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Mobile accordion group
// ---------------------------------------------------------------------------

function MobileDropdown({
  item,
  isActive,
  onNavigate,
}: {
  item: NavDropdown;
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupActive = item.children.some((c) => isActive(c.href));

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`w-full flex items-center justify-between min-h-[56px] py-4 font-display font-semibold uppercase tracking-[.08em] text-[18px] border-b border-ink-3 transition-colors ${
          groupActive ? "text-steel" : "text-bone hover:text-steel"
        }`}
      >
        <span>{item.name}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? "max-h-[400px]" : "max-h-0"
        }`}
      >
        <ul className="pb-2">
          {item.children.map((child) => {
            const active = isActive(child.href);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  className={`flex items-center justify-between min-h-[48px] py-3 pl-6 font-display font-semibold uppercase tracking-[.08em] text-[15px] border-b border-ink-3/50 transition-colors ${
                    active ? "text-steel" : "text-bone/70 hover:text-steel"
                  }`}
                >
                  <span>{child.name}</span>
                  {active && (
                    <span aria-hidden="true" className="font-mono text-[10px] tracking-[.2em] text-steel">
                      ·
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.dataset.menuOpen = "true";
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        delete document.body.dataset.menuOpen;
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b border-[color:var(--line-soft)] backdrop-blur-md"
        style={{ background: "rgba(241,236,225,.92)" }}
      >
        <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-6 px-7 py-3.5">
          {/* Logo */}
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
              <span className="font-display font-bold uppercase tracking-[.06em] text-[20px]">
                F3 Marietta
              </span>
              <span className="font-mono text-[10px] tracking-[.18em] uppercase text-muted">
                Fitness · Fellowship · Faith
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                if (isDropdown(item)) {
                  return (
                    <DesktopDropdown key={item.name} item={item} isActive={isActive} />
                  );
                }
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
                      {active && (
                        <span
                          className="absolute left-3.5 right-3.5 bottom-1 h-[2px] bg-steel"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ChamferButton href="/workouts" variant="ink" size="sm" className="ml-2">
              Find a Workout
            </ChamferButton>
          </nav>

          {/* Mobile hamburger */}
          {!open && (
            <button
              type="button"
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center text-ink -mr-2"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={false}
              aria-controls="mobile-menu-panel"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
        </div>
      </header>

      {/* Fullscreen mobile menu overlay */}
      <div
        id="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className={`lg:hidden fixed inset-0 z-[10000] bg-ink text-bone flex flex-col transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Mobile header row */}
        <div className="flex items-center justify-between px-7 py-3.5 border-b border-ink-3">
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
            <Image
              src="/images/new-f3-marietta-logo.png"
              alt=""
              width={56}
              height={56}
              className="h-12 w-12 rounded-full object-cover border-[1.5px] border-bone/30"
            />
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-display font-bold uppercase tracking-[.06em] text-[18px] text-bone">
                F3 Marietta
              </span>
              <span className="font-mono text-[10px] tracking-[.18em] uppercase text-bone/50">
                Fitness · Fellowship · Faith
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="inline-flex h-11 w-11 items-center justify-center text-bone -mr-2"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              if (isDropdown(item)) {
                return (
                  <MobileDropdown
                    key={item.name}
                    item={item}
                    isActive={isActive}
                    onNavigate={() => setOpen(false)}
                  />
                );
              }
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between min-h-[56px] py-4 font-display font-semibold uppercase tracking-[.08em] text-[18px] border-b border-ink-3 transition-colors ${
                      active ? "text-steel" : "text-bone hover:text-steel"
                    }`}
                  >
                    <span>{item.name}</span>
                    {active && (
                      <span aria-hidden="true" className="font-mono text-[10px] tracking-[.2em] text-steel">
                        ·
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-8">
            <ChamferButton
              href="/workouts"
              variant="steel"
              size="md"
              className="w-full justify-center"
            >
              Find a Workout
            </ChamferButton>
          </div>

          <div className="mt-10 pt-6 border-t border-ink-3">
            <p className="font-mono text-[10px] tracking-[.2em] uppercase text-bone/50 mb-3">
              {`// Follow the Region`}
            </p>
            <ul className="flex items-center gap-3">
              {MENU_SOCIALS.filter((s) => s.href).map(({ id, label, href, Icon }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    aria-label={`F3 Marietta on ${label}`}
                    className="inline-flex h-11 w-11 items-center justify-center border border-bone/25 text-bone hover:text-ink hover:bg-bone transition-colors"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
