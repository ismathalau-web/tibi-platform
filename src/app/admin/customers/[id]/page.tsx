import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import { formatXOF, formatDate } from '@/lib/format';
import { CustomerSalesTable } from './customer-sales-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: c } = await supabase.from('customers').select('name, email').eq('id', params.id).maybeSingle();
  return { title: c?.name ?? c?.email ?? 'Customer' };
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, phone, created_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!customer) notFound();

  const { data: salesData } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, total_xof, payment_method, seller_name, customer_name, is_locked, voided_at')
    .eq('customer_id', params.id)
    .order('created_at', { ascending: false });

  const sales = (salesData ?? []) as any[];

  const validSales = sales.filter((s: any) => !s.voided_at);
  const totalSpent = validSales.reduce((s, row) => s + row.total_xof, 0);
  const avgBasket = validSales.length > 0 ? Math.round(totalSpent / validSales.length) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-[980px]">
      <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
        <Link href="/admin/customers" className="hover:text-ink">Customers</Link>
        <span>/</span>
        <span className="text-ink">{(customer as any).name ?? (customer as any).email ?? '—'}</span>
      </div>

      <header>
        <h1 className="tibi-page-title">{(customer as any).name ?? (customer as any).email ?? 'Unnamed customer'}</h1>
        <p className="text-[12px] text-ink-hint mt-1">
          {[(customer as any).email, (customer as any).phone].filter(Boolean).join(' · ') || '—'}
          {' · '}
          First seen {formatDate((customer as any).created_at)}
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <div className="tibi-card">
          <div className="tibi-label mb-1">Sales</div>
          <div className="text-[24px] font-medium tabular-nums">{validSales.length}</div>
        </div>
        <div className="tibi-card">
          <div className="tibi-label mb-1">Total spent</div>
          <div className="text-[24px] font-medium tabular-nums">{formatXOF(totalSpent)}</div>
        </div>
        <div className="tibi-card">
          <div className="tibi-label mb-1">Average basket</div>
          <div className="text-[24px] font-medium tabular-nums">{formatXOF(avgBasket)}</div>
        </div>
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="tibi-section-title">Sales history</h2>
          <span className="text-[11px] text-ink-hint">Click a row to open the sale</span>
        </div>
        <CustomerSalesTable rows={sales} />
      </section>
    </div>
  );
}
