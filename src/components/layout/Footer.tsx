import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const REGION_LINKS = [
  { label: "About", href: "/about" },
  { label: "Workouts", href: "/workouts" },
  { label: "New Here", href: "/new-here" },
  { label: "FNGs", href: "/fng" },
];

const RESOURCE_LINKS = [
  { label: "Backblasts", href: "/backblasts" },
  { label: "Glossary", href: "/glossary" },
  { label: "What to Expect", href: "/what-to-expect" },
  { label: "Community", href: "/community" },
];

const CONNECT_LINKS = [
  { label: "Contact", href: "/contact" },
  { label: "F3 Nation", href: "https://f3nation.com", external: true },
];

export function Footer() {
  return (
    <footer className="relative bg-ink text-bone">
      <div className="max-w-[1320px] mx-auto px-7 pt-20 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-bone p-1">
                <Image
                  src="/icons/f3mariettalogo-main.png"
                  alt="F3 Marietta"
                  width={72}
                  height={72}
                  className="h-16 w-16 rounded-full object-cover"
                />
              </div>
              <span className="font-display font-bold uppercase tracking-[.06em] text-[26px]">F3 Marietta</span>
            </div>
            <p className="text-[14px] text-bone/60 max-w-[280px] leading-[1.6]">
              Free, peer-led workouts for men in Marietta, GA. Rain or shine, heat or cold — we muster at 05:15.
            </p>
          </div>

          {[
            { header: "Region", links: REGION_LINKS },
            { header: "Resources", links: RESOURCE_LINKS },
            { header: "Connect", links: CONNECT_LINKS },
          ].map((col) => (
            <div key={col.header}>
              <MonoTag variant="bone" className="block mb-5">{`// ${col.header}`}</MonoTag>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-display font-semibold uppercase tracking-[.05em] text-[16px] text-bone hover:text-steel transition-colors"
                      {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-ink-3 flex flex-col md:flex-row justify-between gap-3 font-mono text-[11px] tracking-[.1em] uppercase text-bone/70">
          <span>// F3 Marietta · Marietta, GA · Est. 2024</span>
          <span>A Region of F3 Nation · Peer-Led · Free of Charge</span>
        </div>
      </div>
    </footer>
  );
}
