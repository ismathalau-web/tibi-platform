'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { StatCard } from '@/components/ui/card';
import { formatXOF, formatDate, formatNumber } from '@/lib/format';
import type { SalesReport, TimeBucket } from '@/lib/data/reports';

const ranges: Array<{ id: TimeBucket; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'year', label: 'Year' },
];

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SalesReportView({ report }: { report: SalesReport }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('range') ?? report.bucket;

  function setRange(r: TimeBucket) {
    const q = new URLSearchParams(params.toString());
    q.set('range', r);
    router.push(`${pathname}?${q.toString()}`);
  }

  function csv(filename: string, rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map((h) => JSON.stringify(r[h] ?? '')).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Reports</h1>
          <p className="text-[12px] text-ink-hint mt-1">
            {formatDate(report.since)} → {formatDate(report.until)}
          </p>
        </div>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`text-[11px] px-3 h-7 rounded-pill border-hairline border ${current === r.id ? 'bg-ink text-white border-ink' : 'border-border text-ink-secondary'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net GMV"
          value={formatXOF(report.gmv_xof)}
          hint={
            report.refunds_xof > 0
              ? `Gross ${formatXOF(report.gross_gmv_xof)}`
              : 'After refunds · voids excluded'
          }
        />
        <StatCard label="Transactions" value={formatNumber(report.tx_count)} hint="Completed" />
        <StatCard label="Avg basket" value={formatXOF(report.average_basket_xof)} />
        <StatCard label="Dormant items" value={report.dormant.length} />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Refunds"
          value={report.refunds_xof > 0 ? `−${formatXOF(report.refunds_xof)}` : formatXOF(0)}
          hint={`${report.refunds_count} refund${report.refunds_count === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Voided sales"
          value={formatXOF(report.voided_xof)}
          hint={`${report.voided_count} void${report.voided_count === 1 ? '' : 's'}`}
        />
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="tibi-card">
          <h2 className="tibi-section-title mb-3">By payment method</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={report.by_payment}>
                <XAxis dataKey="method" stroke="#bbb" fontSize={10} />
                <YAxis stroke="#bbb" fontSize={10} />
                <Tooltip formatter={(v: number) => formatXOF(v)} />
                <Bar dataKey="total_xof" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="tibi-card">
          <h2 className="tibi-section-title mb-3">By hour of day</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={report.by_hour}>
                <XAxis dataKey="hour" stroke="#bbb" fontSize={10} />
                <YAxis stroke="#bbb" fontSize={10} />
                <Tooltip formatter={(v: number) => formatXOF(v)} />
                <Bar dataKey="total_xof" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="tibi-card">
        <h2 className="tibi-section-title mb-3">By day of week</h2>
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={report.by_weekday.map((d) => ({ ...d, label: weekdays[d.weekday] }))}>
              <XAxis dataKey="label" stroke="#bbb" fontSize={10} />
              <YAxis stroke="#bbb" fontSize={10} />
              <Tooltip formatter={(v: number) => formatXOF(v)} />
              <Bar dataKey="total_xof" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="tibi-section-title">By seller</h2>
          <button className="text-[11px] text-ink-secondary hover:text-ink" onClick={() => csv('sellers.csv', report.by_seller)}>Export CSV</button>
        </div>
        <table className="tibi-table">
          <thead><tr><th>Seller</th><th className="text-right">Tx</th><th className="text-right">GMV</th></tr></thead>
          <tbody>
            {report.by_seller.length === 0 ? <tr><td colSpan={3} className="text-center text-ink-hint py-6">No sales yet.</td></tr> :
              report.by_seller.map((s) => (
                <tr key={s.seller}>
                  <td>{s.seller}</td>
                  <td className="text-right">{s.tx}</td>
                  <td className="text-right">{formatXOF(s.total_xof)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="tibi-section-title">Top 10 items</h2>
          <button className="text-[11px] text-ink-secondary hover:text-ink" onClick={() => csv('top-items.csv', report.top_items)}>Export CSV</button>
        </div>
        <table className="tibi-table">
          <thead><tr><th>Item</th><th>Brand</th><th className="text-right">Qty</th><th className="text-right">GMV</th></tr></thead>
          <tbody>
            {report.top_items.length === 0 ? <tr><td colSpan={4} className="text-center text-ink-hint py-6">No sales yet.</td></tr> :
              report.top_items.map((t, i) => (
                <tr key={i}>
                  <td>{t.product}</td>
                  <td className="text-ink-secondary">{t.brand}</td>
                  <td className="text-right">{t.qty}</td>
                  <td className="text-right">{formatXOF(t.total_xof)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="tibi-section-title">Dormant stock <span className="text-[11px] text-ink-hint font-normal">· no sale in 30+ days</span></h2>
          <button className="text-[11px] text-ink-secondary hover:text-ink" onClick={() => csv('dormant.csv', report.dormant)}>Export CSV</button>
        </div>
        <table className="tibi-table">
          <thead><tr><th>SKU</th><th>Item</th><th>Brand</th><th className="text-right">Stock</th><th className="text-right">Days</th></tr></thead>
          <tbody>
            {report.dormant.length === 0 ? <tr><td colSpan={5} className="text-center text-ink-hint py-6">Nothing dormant.</td></tr> :
              report.dormant.map((d) => (
                <tr key={d.variant_id}>
                  <td className="font-mono text-[11px] text-ink-hint">{d.sku}</td>
                  <td>{d.product}</td>
                  <td className="text-ink-secondary">{d.brand}</td>
                  <td className="text-right">{d.stock_qty}</td>
                  <td className="text-right text-ink-secondary">{d.last_sale_days === null ? '—' : d.last_sale_days}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <div className="flex gap-3 flex-wrap">
        <Link href="/admin/reports/close" className="tibi-btn tibi-btn-secondary">Daily close</Link>
        <Link href="/admin/reports/accounting" className="tibi-btn tibi-btn-secondary">Accounting (CA imposable)</Link>
      </div>
    </div>
  );
}
