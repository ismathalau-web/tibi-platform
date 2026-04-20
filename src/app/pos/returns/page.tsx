import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatXOF } from '@/lib/format';

export const metadata = { title: 'Returns' };
export const dynamic = 'force-dynamic';

export default async function ReturnsHistoryPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('returns')
    .select(`
      id, qty, reason, refund_xof, created_at, seller_name, refund_method, notes, batch_id,
      return_batches(credit_note_no),
      sale_items!inner(
        id, sale_id, unit_price_xof,
        variants!inner(sku, products!inner(name)),
        brands!inner(name),
        sales!inner(invoice_no, customer_name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    qty: r.qty ?? 1,
    refund_xof: r.refund_xof,
    reason: r.reason,
    refund_method: r.refund_method ?? '—',
    seller_name: r.seller_name,
    notes: r.notes,
    batch_id: r.batch_id ?? null,
    credit_note_no: r.return_batches?.credit_note_no ?? null,
    item_name: r.sale_items.variants.products.name,
    sku: r.sale_items.variants.sku,
    brand_name: r.sale_items.brands.name,
    sale_id: r.sale_items.sale_id,
    invoice_no: r.sale_items.sales.invoice_no,
    customer_name: r.sale_items.sales.customer_name,
  }));

  return (
    <div className="p-5 max-w-[980px] mx-auto flex flex-col gap-5">
      <header>
        <h1 className="tibi-page-title">Returns history</h1>
        <p className="text-[12px] text-ink-hint mt-1">
          To create a new return, open a sale from{' '}
          <Link href="/pos/sales" className="underline hover:text-ink">Recent sales</Link>{' '}
          and click <strong>Return items</strong>.
        </p>
      </header>

      <div className="tibi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>When</th>
                <th>CN #</th>
                <th>Invoice</th>
                <th>Item</th>
                <th>Customer</th>
                <th>Seller</th>
                <th>Method</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Refund</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-ink-hint py-10">No returns yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-ink-secondary text-[12px]">
                    {new Date(r.created_at).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="font-mono text-[12px]">
                    {r.credit_note_no ? `CN-${String(r.credit_note_no).padStart(4, '0')}` : '—'}
                  </td>
                  <td className="font-mono text-[12px]">
                    <Link href={`/pos/sales/${r.sale_id}`} className="hover:underline">#{r.invoice_no}</Link>
                  </td>
                  <td>
                    {r.item_name}
                    <div className="text-[11px] text-ink-hint">{r.brand_name} · {r.sku}</div>
                    {r.reason && <div className="text-[11px] text-ink-secondary mt-0.5">{r.reason}</div>}
                  </td>
                  <td className="text-ink-secondary">{r.customer_name ?? '—'}</td>
                  <td>{r.seller_name}</td>
                  <td className="text-ink-secondary capitalize">{(r.refund_method ?? '').replace('_', ' ')}</td>
                  <td className="text-right">{r.qty}</td>
                  <td className="text-right font-medium tabular-nums">{formatXOF(r.refund_xof)}</td>
                  <td>
                    {r.batch_id && (
                      <a
                        href={`/api/credit-note/${r.batch_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-ink hover:underline"
                      >
                        ↓ PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
