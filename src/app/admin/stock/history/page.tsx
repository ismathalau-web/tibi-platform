import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Stock adjustments' };
export const dynamic = 'force-dynamic';

const reasonLabels: Record<string, string> = {
  damaged: 'Damaged',
  lost: 'Lost',
  theft: 'Theft',
  correction: 'Correction',
  other: 'Other',
};

const reasonTone: Record<string, 'neutral' | 'warning' | 'danger' | 'success'> = {
  damaged: 'warning',
  lost: 'warning',
  theft: 'danger',
  correction: 'neutral',
  other: 'neutral',
};

export default async function StockHistoryPage({ searchParams }: { searchParams: { variant?: string } }) {
  await requireUser();
  const supabase = createAdminClient();

  let q = supabase
    .from('stock_adjustments')
    .select(`
      id, delta_qty, reason, notes, created_by, created_at,
      variants!inner(id, sku, size, color, products!inner(name), brands!inner(name))
    `)
    .order('created_at', { ascending: false })
    .limit(200);
  if (searchParams.variant) q = q.eq('variant_id', searchParams.variant);
  const { data } = await q;

  const rows = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    delta_qty: r.delta_qty as number,
    reason: r.reason as string,
    notes: r.notes as string | null,
    created_by: r.created_by as string | null,
    created_at: r.created_at as string,
    variant_id: r.variants.id as string,
    sku: r.variants.sku as string,
    size: r.variants.size as string | null,
    color: r.variants.color as string | null,
    product: r.variants.products.name as string,
    brand: r.variants.brands.name as string,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
        <Link href="/stock" className="hover:text-ink">Stock</Link>
        <span>/</span>
        <span className="text-ink">Adjustment history</span>
      </div>

      <header>
        <h1 className="tibi-page-title">Stock adjustments</h1>
        <p className="text-[12px] text-ink-hint mt-1">
          Audit trail — every correction, loss, damage recorded. {rows.length} entries{searchParams.variant ? ' (filtered)' : ''}.
        </p>
      </header>

      <div className="tibi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Brand</th>
                <th>SKU</th>
                <th className="text-right">Change</th>
                <th>Reason</th>
                <th>Notes</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-ink-hint py-10">No stock adjustments yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-ink-secondary text-[11px]">
                    {new Date(r.created_at).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>
                    <div>{r.product}</div>
                    <div className="text-[11px] text-ink-secondary">{[r.size, r.color].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className="text-ink-secondary">{r.brand}</td>
                  <td className="font-mono text-[11px] text-ink-hint">{r.sku}</td>
                  <td className={`text-right font-medium ${r.delta_qty > 0 ? 'text-success-fg' : r.delta_qty < 0 ? 'text-danger-fg' : ''}`}>
                    {r.delta_qty > 0 ? `+${r.delta_qty}` : r.delta_qty}
                  </td>
                  <td><Badge tone={reasonTone[r.reason] ?? 'neutral'}>{reasonLabels[r.reason] ?? r.reason}</Badge></td>
                  <td className="text-ink-secondary text-[12px]">{r.notes ?? '—'}</td>
                  <td className="text-ink-secondary text-[11px]">{r.created_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
