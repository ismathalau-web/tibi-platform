import { createAdminClient } from '@/lib/supabase/admin';
import { AdminSalesTable } from './admin-sales-table';

export const metadata = { title: 'Sales' };
export const dynamic = 'force-dynamic';

export default async function AdminSalesPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const supabase = createAdminClient();
  let query = supabase
    .from('sales')
    .select('id, invoice_no, created_at, total_xof, payment_method, seller_name, customer_name, is_locked, voided_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (searchParams.q) {
    const n = parseInt(searchParams.q, 10);
    if (!Number.isNaN(n)) {
      query = query.eq('invoice_no', n);
    } else {
      query = query.ilike('customer_name', `%${searchParams.q}%`);
    }
  }

  const { data: sales } = await query;
  const rows = (sales ?? []) as any[];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="tibi-page-title">Sales</h1>
        <p className="text-[12px] text-ink-hint mt-1">All sales · click a row for details, return, exchange, edit, void</p>
      </header>

      <AdminSalesTable rows={rows} initialQuery={searchParams.q ?? ''} />
    </div>
  );
}
