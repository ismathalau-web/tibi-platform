'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/lib/supabase/types';

export interface NavCounts {
  pendingReceptions?: number;
  pendingPreorders?: number;
}

// adminOnly: hidden for seller role
const items: Array<{ href: string; label: string; badgeKey?: keyof NavCounts; adminOnly?: boolean }> = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/receptions', label: 'Receptions', badgeKey: 'pendingReceptions' },
  { href: '/stock', label: 'Stock' },
  { href: '/pos', label: 'POS' },
  { href: '/admin/sales', label: 'Sales' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/preorders', label: 'Pre-orders', badgeKey: 'pendingPreorders' },
  { href: '/admin/settings', label: 'Settings', adminOnly: true },
];

function CountPill({ n }: { n: number }) {
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-pill bg-ink text-white text-[10px] font-medium tabular-nums">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function Sidebar({ counts = {}, role = 'admin' }: { counts?: NavCounts; role?: UserRole }) {
  const pathname = usePathname();
  const visibleItems = items.filter((it) => !it.adminOnly || role === 'admin');
  return (
    <aside className="hidden md:flex md:w-[220px] md:flex-col md:border-r md:border-hairline md:border-border md:bg-bg md:sticky md:top-0 md:h-dvh">
      <div className="px-5 pt-6 pb-8">
        <Link href="/admin" className="text-[15px] font-medium tracking-[0.18em] text-ink">TIBI</Link>
        <div className="text-[10px] tracking-[0.14em] uppercase text-ink-hint mt-1">Cotonou</div>
      </div>
      <nav className="flex-1 px-2">
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map((it) => {
            const active = pathname === it.href || (it.href !== '/admin' && pathname.startsWith(it.href));
            const badgeN = it.badgeKey ? counts[it.badgeKey] ?? 0 : 0;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-input text-[13px] transition-colors',
                    active ? 'bg-surface text-ink font-medium' : 'text-ink-body hover:bg-hover hover:text-ink',
                  )}
                >
                  <span>{it.label}</span>
                  {badgeN > 0 && <CountPill n={badgeN} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form action="/auth/signout" method="post" className="px-3 pb-6">
        <button type="submit" className="w-full text-left text-[12px] text-ink-secondary hover:text-ink px-3 py-2">
          Sign out
        </button>
      </form>
    </aside>
  );
}

export function BottomNav({ role = 'admin' }: { role?: UserRole }) {
  const pathname = usePathname();
  const bottomItems = [
    { href: '/admin', label: 'Home' },
    { href: '/stock', label: 'Stock' },
    { href: '/pos', label: 'POS' },
    { href: '/admin/reports', label: 'Reports' },
    role === 'admin'
      ? { href: '/admin/settings', label: 'Settings' }
      : { href: '/admin/receptions', label: 'Receptions' },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-hairline border-border bg-bg z-40">
      <ul className="grid grid-cols-5 text-[10px] tracking-[0.1em] uppercase">
        {bottomItems.map((it) => {
          const active = pathname === it.href || (it.href !== '/admin' && pathname.startsWith(it.href));
          return (
            <li key={it.href} className="text-center">
              <Link
                href={it.href}
                className={cn(
                  'block py-3',
                  active ? 'text-ink font-medium' : 'text-ink-hint',
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
