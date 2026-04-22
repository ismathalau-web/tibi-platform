'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  isActive: (pathname: string, tab: string | null) => boolean;
}

const items: NavItem[] = [
  { label: 'Sales',     href: '/admin/reports?tab=sales',     isActive: (p, t) => p === '/admin/reports' && (t ?? 'sales') === 'sales' },
  { label: 'Brands',    href: '/admin/reports?tab=brands',    isActive: (p, t) => p === '/admin/reports' && t === 'brands' },
  { label: 'Inventory', href: '/admin/reports?tab=inventory', isActive: (p, t) => p === '/admin/reports' && t === 'inventory' },
  { label: 'Wholesale', href: '/admin/reports?tab=wholesale', isActive: (p, t) => p === '/admin/reports' && t === 'wholesale' },
  { label: 'Dormant',   href: '/admin/reports/dormant',       isActive: (p) => p.startsWith('/admin/reports/dormant') },
  { label: 'Daily close', href: '/admin/reports/close',       isActive: (p) => p.startsWith('/admin/reports/close') },
  { label: 'Accounting', href: '/admin/reports/accounting',   isActive: (p) => p.startsWith('/admin/reports/accounting') },
];

/**
 * Shared tab nav for all /admin/reports/* pages.
 * Each report (sales/brands/inventory/wholesale/dormant/close/accounting)
 * gets the same horizontal tab bar so admins can switch between them
 * without going back to a "Reports home".
 */
export function ReportsNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get('tab');

  return (
    <nav className="flex gap-1 border-b border-hairline border-divider overflow-x-auto">
      {items.map((it) => {
        const active = it.isActive(pathname, tab);
        return (
          <Link
            key={it.label}
            href={it.href}
            className={`px-4 py-2 text-[12px] border-b-2 whitespace-nowrap ${
              active
                ? 'border-ink text-ink font-medium'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
