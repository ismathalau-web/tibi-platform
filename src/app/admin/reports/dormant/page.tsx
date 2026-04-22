import { getSalesReport } from '@/lib/data/reports';
import { formatXOF } from '@/lib/format';
import { ReportsNav } from '../reports-nav';

export const metadata = { title: 'Dormant stock' };
export const dynamic = 'force-dynamic';

export default async function DormantPage() {
  const report = await getSalesReport('cycle');
  const rows = report.dormant;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="tibi-page-title">Dormant stock</h1>
        <p className="text-[12px] text-ink-hint mt-1">Items with no sale in the last 30 days — {rows.length} total.</p>
      </header>

      <ReportsNav />

      <div className="tibi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Brand</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Days since last sale</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-ink-hint py-8">Nothing dormant.</td></tr>
              ) : rows.map((d) => (
                <tr key={d.variant_id}>
                  <td className="font-mono text-[11px] text-ink-hint">{d.sku}</td>
                  <td>{d.product}</td>
                  <td className="text-ink-secondary">{d.brand}</td>
                  <td className="text-right">{d.stock_qty}</td>
                  <td className="text-right text-ink-secondary">{d.last_sale_days ?? 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
