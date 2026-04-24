import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBrand, getActiveCycle } from '@/lib/data/brands';
import { createClient } from '@/lib/supabase/server';
import { BrandTypeBadge, Badge } from '@/components/ui/badge';
import { BrandForm } from '../brand-form';
import { ShareLinkPanel } from './share-link-panel';
import { CommissionPanel } from './commission-panel';
import { PaymentsPanel } from './payments-panel';
import { CycleClosePanel } from './cycle-close-panel';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const brand = await getBrand(params.id);
  return { title: brand?.name ?? 'Brand' };
}

export default async function BrandDetail({ params }: { params: { id: string } }) {
  const [brand, cycle] = await Promise.all([getBrand(params.id), getActiveCycle()]);
  if (!brand) notFound();

  const supabase = createClient();

  // Balance due for active cycle (only consignment brands)
  let balanceDueXof = 0;
  if (brand.type === 'consignment' && cycle) {
    const [{ data: items }, { data: payments }] = await Promise.all([
      supabase
        .from('sale_items')
        .select('unit_price_xof, qty, commission_xof, sales!inner(cycle_id)')
        .eq('brand_id', brand.id)
        .eq('item_type', 'consignment')
        .eq('sales.cycle_id', cycle.id),
      supabase.from('brand_payments').select('amount_xof').eq('brand_id', brand.id).eq('cycle_id', cycle.id),
    ]);
    const gross = ((items ?? []) as any[]).reduce((s, it) => s + (it.unit_price_xof * it.qty - (it.commission_xof ?? 0)), 0);
    const paid = ((payments ?? []) as Array<{ amount_xof: number }>).reduce((s, p) => s + p.amount_xof, 0);
    balanceDueXof = Math.max(0, gross - paid);
  }

  // Unsold variants (stock_qty > 0, not yet returned) for cycle-close panel
  const { data: unsoldRaw } = brand.type === 'consignment'
    ? await supabase
        .from('variants')
        .select('id, sku, size, color, retail_price_xof, stock_qty, products!inner(name)')
        .eq('brand_id', brand.id)
        .eq('status', 'active')
        .is('returned_at', null)
        .gt('stock_qty', 0)
        .order('created_at', { ascending: true })
    : { data: [] as any[] };
  const unsold = ((unsoldRaw ?? []) as any[]).map((v) => ({
    id: v.id,
    product_name: v.products.name,
    sku: v.sku,
    size: v.size,
    color: v.color,
    retail_price_xof: v.retail_price_xof,
    stock_qty: v.stock_qty,
  }));

  const { data: paymentHistoryRaw } = await supabase
    .from('brand_payments')
    .select('id, amount_xof, paid_at, notes, cycles!inner(name)')
    .eq('brand_id', brand.id)
    .order('paid_at', { ascending: false });
  const paymentHistory = ((paymentHistoryRaw ?? []) as any[]).map((p) => ({
    id: p.id,
    amount_xof: p.amount_xof,
    paid_at: p.paid_at,
    notes: p.notes,
    cycle_name: p.cycles.name,
  }));

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
        <Link href="/admin/brands" className="hover:text-ink">Brands</Link>
        <span>/</span>
        <span className="text-ink">{brand.name}</span>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="tibi-page-title">{brand.name}</h1>
        <BrandTypeBadge type={brand.type} />
        {brand.type === 'consignment' && brand.commission_status === 'pending' && (
          <Badge tone="warning">Commission pending</Badge>
        )}
      </header>

      {brand.type === 'consignment' && (
        <CommissionPanel
          brandId={brand.id}
          initialPct={brand.commission_pct}
          initialStatus={brand.commission_status}
        />
      )}

      {brand.type === 'consignment' && (
        <PaymentsPanel
          brandId={brand.id}
          balanceDueXof={balanceDueXof}
          currentCycleId={cycle?.id ?? null}
          history={paymentHistory}
        />
      )}

      {brand.type === 'consignment' && brand.share_token && (
        <ShareLinkPanel brandId={brand.id} token={brand.share_token} />
      )}

      {brand.type === 'consignment' && (
        <CycleClosePanel
          brandId={brand.id}
          brandName={brand.name}
          shareToken={brand.share_token}
          cycleName={cycle?.name ?? null}
          unsold={unsold}
        />
      )}

      <section className="tibi-card">
        <h2 className="tibi-section-title mb-4">Profile</h2>
        <BrandForm mode="edit" brand={brand} />
      </section>
    </div>
  );
}
