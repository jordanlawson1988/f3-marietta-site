'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthGate from '@/components/AuthGate';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Pending Drafts' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/dashboard/newsletter', label: 'Newsletter' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGate>
      <div className="min-h-screen flex flex-col">
        <nav className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-semibold text-foreground">
            F3 Automation
          </Link>
          <div className="flex gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </AuthGate>
  );
}
