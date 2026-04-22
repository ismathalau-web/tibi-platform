import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';

export default async function PosLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-hairline border-border px-4 py-3">
        <Link href="/" className="text-[13px] font-medium tracking-[0.18em] text-ink">TIBI</Link>
        <div className="flex items-center gap-3 text-[12px] text-ink-secondary">
          <Link href="/pos" className="hover:text-ink">Sell</Link>
          <Link href="/pos/sales" className="hover:text-ink">Sales</Link>
          <Link href="/stock" className="hover:text-ink">Stock</Link>
          <Link href="/pos/returns" className="hover:text-ink">Returns</Link>
          <Link href="/pos/preorder" className="hover:text-ink">Pre-order</Link>
          <Link href="/pos/close-day" className="hover:text-ink">Daily close</Link>
          {user.role === 'admin' && (
            <Link href="/admin" className="hover:text-ink">Admin</Link>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
