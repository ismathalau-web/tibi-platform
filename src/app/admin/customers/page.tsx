import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatXOF } from '@/lib/format';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, phone, created_at')
    .order('created_at', { ascending: false });

  const customers = (data ?? []) as Array<{ id: string; name: string | null; email: string | null; phone: string | null; created_at: string }>;

  const { data: salesAgg } = customers.length > 0
    ? await supabase
        .from('sales')
        .select('customer_id, total_xof')
        .not('customer_id', 'is', null)
    : { data: [] as Array<{ customer_id: string; total_xof: number }> };

  const byCustomer = new Map<string, { count: number; total: number }>();
  for (const s of (salesAgg ?? []) as Array<{ customer_id: string; total_xof: number }>) {
    const cur = byCustomer.get(s.customer_id) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += s.total_xof;
    byCustomer.set(s.customer_id, cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="tibi-page-title">Customers</h1>
        <p className="text-[12px] text-ink-hint mt-1">{customers.length} customer{customers.length > 1 ? 's' : ''} recorded. Automatically deduplicated by email or phone.</p>
      </header>

      <div className="tibi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="text-right">Purchases</th>
                <th className="text-right">Total spent</th>
                <th>First seen</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-ink-hint py-10">No customers yet.</td></tr>
              ) : customers.map((c) => {
                const stats = byCustomer.get(c.id) ?? { count: 0, total: 0 };
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="hover:underline">
                        {c.name ?? c.email ?? '—'}
                      </Link>
                    </td>
                    <td className="text-ink-secondary text-[12px]">{c.email ?? '—'}</td>
                    <td className="text-ink-secondary text-[12px]">{c.phone ?? '—'}</td>
                    <td className="text-right">{stats.count}</td>
                    <td className="text-right">{formatXOF(stats.total)}</td>
                    <td className="text-ink-secondary text-[11px]">{formatDate(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
