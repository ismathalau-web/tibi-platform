import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PosLocaleProvider } from '@/lib/i18n/use-pos-locale';
import { PosHeaderLinks } from './pos-header-client';

export default async function PosLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <PosLocaleProvider>
      <div className="min-h-dvh flex flex-col bg-bg">
        <header className="flex items-center justify-between border-b border-hairline border-border px-4 py-3">
          <Link href="/" className="text-[13px] font-medium tracking-[0.18em] text-ink">TIBI</Link>
          <PosHeaderLinks isAdmin={user.role === 'admin'} />
        </header>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </PosLocaleProvider>
  );
}
