'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePosLocale } from '@/lib/i18n/use-pos-locale';

export function PosHeaderLinks({ isAdmin }: { isAdmin: boolean }) {
  const { t, locale, setLocale } = usePosLocale();
  const pathname = usePathname();

  const link = (href: string, label: string) => {
    const active = pathname === href || (href !== '/pos' && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        className={`hover:text-ink transition-colors ${active ? 'text-ink font-medium' : ''}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex items-center gap-3 text-[12px] text-ink-secondary">
      {link('/pos', t('sell'))}
      {link('/pos/sales', t('sales'))}
      {link('/stock', t('stock'))}
      {link('/pos/returns', t('returns'))}
      {link('/pos/preorder', t('preorder'))}
      {link('/pos/close-day', t('closeDay'))}
      {isAdmin && link('/admin', t('admin'))}
      <div className="flex items-center border-hairline border border-border rounded-pill overflow-hidden">
        <button
          onClick={() => setLocale('en')}
          className={`px-2.5 h-6 text-[10px] font-medium uppercase tracking-wider transition-colors ${locale === 'en' ? 'bg-ink text-white' : 'text-ink-secondary hover:bg-hover'}`}
          aria-label="English"
        >
          EN
        </button>
        <button
          onClick={() => setLocale('fr')}
          className={`px-2.5 h-6 text-[10px] font-medium uppercase tracking-wider transition-colors ${locale === 'fr' ? 'bg-ink text-white' : 'text-ink-secondary hover:bg-hover'}`}
          aria-label="Français"
        >
          FR
        </button>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className="hover:text-ink">{t('signOut')}</button>
      </form>
    </div>
  );
}
