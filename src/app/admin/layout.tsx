import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar, BottomNav, type NavCounts } from '@/components/admin/sidebar';

async function getNavCounts(): Promise<NavCounts> {
  const supabase = createClient();
  // Pending receptions: stock_movements where qty_confirmed < qty_sent.
  // PostgREST doesn't support column-to-column comparison, so we fetch + filter.
  const [movementsRes, preordersRes] = await Promise.all([
    supabase.from('stock_movements').select('id, qty_sent, qty_confirmed'),
    supabase.from('preorders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const movements = (movementsRes.data ?? []) as Array<{ qty_sent: number; qty_confirmed: number }>;
  const pendingReceptions = movements.filter((m) => m.qty_confirmed < m.qty_sent).length;
  const pendingPreorders = preordersRes.count ?? 0;
  return { pendingReceptions, pendingPreorders };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const counts = await getNavCounts();
  return (
    <div className="min-h-dvh flex bg-bg">
      <Sidebar counts={counts} role={user.role} />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-10 md:py-10">{children}</div>
      </main>
      <BottomNav role={user.role} />
    </div>
  );
}
