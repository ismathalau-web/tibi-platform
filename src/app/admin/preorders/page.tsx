import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { PreorderTable } from './preorder-table';

export const metadata = { title: 'Pre-orders' };
export const dynamic = 'force-dynamic';

export default async function PreordersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('preorders')
    .select(`
      id, customer_name, customer_email, customer_phone, customer_contact,
      deposit_xof, balance_xof, total_xof, status, notes, created_at,
      preorder_items(
        qty, unit_price_xof,
        variants!inner(sku, size, color, products!inner(name), brands!inner(name))
      )
    `)
    .order('created_at', { ascending: false });

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    customer_name: r.customer_name,
    customer_email: r.customer_email,
    customer_phone: r.customer_phone ?? r.customer_contact,
    deposit_xof: r.deposit_xof,
    balance_xof: r.balance_xof,
    total_xof: r.total_xof,
    status: r.status,
    notes: r.notes,
    created_at: r.created_at,
    items: ((r.preorder_items ?? []) as any[]).map((it) => ({
      qty: it.qty,
      unit_price_xof: it.unit_price_xof,
      name: it.variants.products.name,
      brand: it.variants.brands.name,
      sku: it.variants.sku,
      size: it.variants.size,
      color: it.variants.color,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Pre-orders</h1>
          <p className="text-[12px] text-ink-hint mt-1">{rows.length} total</p>
        </div>
        <Link href="/pos/preorder">
          <Button>+ New pre-order</Button>
        </Link>
      </header>
      <PreorderTable rows={rows} />
    </div>
  );
}
