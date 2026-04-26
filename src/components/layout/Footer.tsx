import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram } from "lucide-react";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { SOCIAL_LINKS } from "@/lib/socialLinks";

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

// Lucide doesn't ship an X (Twitter rebrand) glyph — use a 24x24 inline mark.
function XMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  { id: "facebook", label: "Facebook", href: SOCIAL_LINKS.facebook, Icon: Facebook },
  { id: "instagram", label: "Instagram", href: SOCIAL_LINKS.instagram, Icon: Instagram },
  { id: "x", label: "X", href: SOCIAL_LINKS.x, Icon: XMark },
] as const;

export function Footer() {
  return (
    <footer className="relative bg-ink text-bone">
      <div className="max-w-[1320px] mx-auto px-7 pt-20 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-bone p-1">
                <Image
                  src="/images/new-f3-marietta-logo.png"
                  alt="F3 Marietta"
                  width={72}
                  height={72}
                  className="h-16 w-16 rounded-full object-cover"
                />
              </div>
              <span className="font-display font-bold uppercase tracking-[.06em] text-[26px]">F3 Marietta</span>
            </div>
            <div className="mt-6">
              <MonoTag variant="bone" className="block mb-3">{`// Follow the Region`}</MonoTag>
              <ul className="flex items-center gap-3">
                {SOCIALS.filter((s) => s.href).map(({ id, label, href, Icon }) => (
                  <li key={id}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
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
