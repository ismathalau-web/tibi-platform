import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Sidebar, BottomNav } from '@/components/admin/sidebar';

/**
 * /stock is shared between admin and seller.
 * Admin gets the admin sidebar for continuity with the rest of admin pages.
 * Seller gets a lightweight POS-style header so they can return to the POS.
 */
export default async function StockLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  if (user.role === 'admin') {
    return (
      <div className="min-h-dvh flex bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-10 md:py-10">{children}</div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Seller wrapper — mirror POS top bar for quick return
  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-hairline border-border px-4 py-3">
        <Link href="/pos" className="text-[13px] font-medium tracking-[0.18em] text-ink">TIBI</Link>
        <div className="flex items-center gap-3 text-[12px] text-ink-secondary">
          <Link href="/pos" className="hover:text-ink">Sell</Link>
          <Link href="/pos/sales" className="hover:text-ink">Sales</Link>
          <Link href="/stock" className="text-ink font-medium">Stock</Link>
          <Link href="/pos/returns" className="hover:text-ink">Returns</Link>
          <Link href="/pos/preorder" className="hover:text-ink">Pre-order</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <div className="flex-1 min-w-0 pb-20">
        <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-10 md:py-10">{children}</div>
      </div>
    </div>
  );
}
