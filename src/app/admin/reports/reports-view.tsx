'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { StatCard } from '@/components/ui/card';
import { Badge, BrandTypeBadge } from '@/components/ui/badge';
import { formatXOF, formatDate, formatNumber, formatPercent } from '@/lib/format';
import type { SalesReport, BrandsReport, InventoryReport, WholesaleReport, TimeBucket } from '@/lib/data/reports';

interface Props {
  sales: SalesReport;
  brands: BrandsReport;
  inventory: InventoryReport;
  wholesale: WholesaleReport;
  tab: 'sales' | 'brands' | 'inventory' | 'wholesale';
  bucket: TimeBucket;
}

const ranges: Array<{ id: TimeBucket; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'year', label: 'Year' },
];

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const tabs: Array<{ id: Props['tab']; label: string }> = [
  { id: 'sales', label: 'Sales' },
  { id: 'brands', label: 'Brands' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'wholesale', label: 'Wholesale & Editions' },
];

export function ReportsView({ sales, brands, inventory, wholesale, tab, bucket }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function navigate(newParams: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(newParams)) q.set(k, v);
    router.push(`${pathname}?${q.toString()}`);
  }

  function csvOf(filename: string, rows: Array<Record<string, unknown>>) {
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

  const pdfHref = `/api/reports/pdf?range=${bucket}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Reports</h1>
          <p className="text-[12px] text-ink-hint mt-1">
            {formatDate(sales.since)} → {formatDate(sales.until)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-2">
            {ranges.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate({ range: r.id })}
                className={`text-[11px] px-3 h-7 rounded-pill border-hairline border ${bucket === r.id ? 'bg-ink text-white border-ink' : 'border-border text-ink-secondary'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <a href={pdfHref} target="_blank" rel="noreferrer" className="tibi-btn tibi-btn-secondary">Download PDF</a>
          <Link href="/admin/reports/accounting" className="tibi-btn tibi-btn-secondary">Accounting</Link>
          <Link href="/admin/reports/close" className="tibi-btn tibi-btn-secondary">Daily close</Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-hairline border-divider">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate({ tab: t.id })}
            className={`px-4 py-2 text-[12px] border-b-2 ${tab === t.id ? 'border-ink text-ink font-medium' : 'border-transparent text-ink-secondary hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && <SalesTab sales={sales} csvOf={csvOf} />}
      {tab === 'brands' && <BrandsTab brands={brands} csvOf={csvOf} />}
      {tab === 'inventory' && <InventoryTab inventory={inventory} csvOf={csvOf} />}
      {tab === 'wholesale' && <WholesaleTab wholesale={wholesale} csvOf={csvOf} />}
    </div>
  );
}

function SalesTab({ sales, csvOf }: { sales: SalesReport; csvOf: (filename: string, rows: any[]) => void }) {
  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="GMV" value={formatXOF(sales.gmv_xof)} hint="Marchandise vendue" accent="ink" />
        <StatCard label="Tibi CA" value={formatXOF(sales.tibi_revenue_xof)} hint="Commissions + wholesale" accent="accent" />
        <StatCard label="Transactions" value={formatNumber(sales.tx_count)} />
        <StatCard label="Avg basket" value={formatXOF(sales.average_basket_xof)} />
      </section>

      {sales.gmv_series.length > 0 && (
        <section className="tibi-card">
          <h2 className="tibi-section-title mb-3">GMV over time</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={sales.gmv_series}>
                <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
                <XAxis dataKey="label" stroke="#bbb" fontSize={10} />
                <YAxis stroke="#bbb" fontSize={10} />
                <Tooltip formatter={(v: number) => formatXOF(v)} />
                <Line type="monotone" dataKey="gmv_xof" stroke="#1a1a1a" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="tibi-card">
          <h2 className="tibi-section-title mb-3">By payment method</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={sales.by_payment}>
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
              <BarChart data={sales.by_hour}>
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
            <BarChart data={sales.by_weekday.map((d) => ({ ...d, label: weekdays[d.weekday] }))}>
              <XAxis dataKey="label" stroke="#bbb" fontSize={10} />
              <YAxis stroke="#bbb" fontSize={10} />
              <Tooltip formatter={(v: number) => formatXOF(v)} />
              <Bar dataKey="total_xof" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <ReportTable
        title="By seller"
        rows={sales.by_seller}
        columns={[
          { key: 'seller', label: 'Seller' },
          { key: 'tx', label: 'Tx', align: 'right' },
          { key: 'total_xof', label: 'GMV', align: 'right', format: formatXOF },
        ]}
        csv={() => csvOf('sellers.csv', sales.by_seller)}
      />

      <ReportTable
        title="Top 10 items"
        rows={sales.top_items}
        columns={[
          { key: 'product', label: 'Item' },
          { key: 'brand', label: 'Brand', muted: true },
          { key: 'qty', label: 'Qty', align: 'right' },
          { key: 'total_xof', label: 'GMV', align: 'right', format: formatXOF },
        ]}
        csv={() => csvOf('top-items.csv', sales.top_items)}
      />

      <ReportTable
        title="Dormant stock"
        subtitle="No sale in 30+ days"
        rows={sales.dormant.slice(0, 10)}
        columns={[
          { key: 'sku', label: 'SKU', muted: true, mono: true },
          { key: 'product', label: 'Item' },
          { key: 'brand', label: 'Brand', muted: true },
          { key: 'stock_qty', label: 'Stock', align: 'right' },
          { key: 'last_sale_days', label: 'Days', align: 'right' },
        ]}
        csv={() => csvOf('dormant.csv', sales.dormant)}
        footer={sales.dormant.length > 10 ? (
          <Link href="/admin/reports/dormant" className="text-[12px] text-ink-secondary hover:text-ink underline-offset-2 hover:underline">
            See all {sales.dormant.length} dormant items →
          </Link>
        ) : null}
      />
    </>
  );
}

function BrandsTab({ brands, csvOf }: { brands: BrandsReport; csvOf: (filename: string, rows: any[]) => void }) {
  return (
    <>
      <div className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="tibi-section-title">{brands.cycle_label}</h2>
          <button onClick={() => csvOf('brands-report.csv', brands.rows)} className="text-[11px] text-ink-secondary hover:text-ink">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Type</th>
                <th className="text-right">GMV</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Sell-through</th>
                <th className="text-right">Commission</th>
                <th className="text-right">Avg days to sell</th>
                <th className="text-right">Stock value</th>
              </tr>
            </thead>
            <tbody>
              {brands.rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-ink-hint py-8">No data.</td></tr>
              ) : brands.rows.map((b) => (
                <tr key={b.brand_id}>
                  <td>{b.name}</td>
                  <td><BrandTypeBadge type={b.type} /></td>
                  <td className="text-right">{formatXOF(b.gmv_xof)}</td>
                  <td className="text-right">{b.units_sold}</td>
                  <td className="text-right">{b.units_sent}</td>
                  <td className="text-right">{formatPercent(b.sell_through_pct, 0)}</td>
                  <td className="text-right">{b.type === 'consignment' ? formatXOF(b.commission_xof) : '—'}</td>
                  <td className="text-right">{b.avg_days_to_sell ?? '—'}</td>
                  <td className="text-right">{formatXOF(b.stock_value_xof)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function InventoryTab({ inventory, csvOf }: { inventory: InventoryReport; csvOf: (filename: string, rows: any[]) => void }) {
  const comparison = inventory.cycle_vs_previous;
  const diff = comparison?.previous ? comparison.current.gmv_xof - comparison.previous.gmv_xof : null;
  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Stock value (retail)" value={formatXOF(inventory.total_stock_value_xof)} hint="Marchandise en boutique" />
        <StatCard label="Items in stock" value={formatNumber(inventory.total_items_in_stock)} />
        <StatCard label="Dû aux marques" value={formatXOF(inventory.total_balance_due_xof)} />
        <StatCard label="Low-stock alerts" value={inventory.alerts_count} hint={`≤ ${inventory.alert_threshold} units`} />
      </section>

      {inventory.projection && (
        <section className="tibi-card">
          <h2 className="tibi-section-title mb-2">End-of-cycle projection</h2>
          <p className="text-[12px] text-ink-hint mb-3">
            Based on current sell rate of <strong>{formatXOF(Math.round(inventory.projection.current_sell_rate_per_day))}/day</strong>,
            with <strong>{inventory.projection.days_left}</strong> days remaining.
          </p>
          <div className="tibi-stat">{formatXOF(inventory.projection.projected_end_of_cycle_gmv_xof)}</div>
        </section>
      )}

      {comparison && (
        <section className="tibi-card">
          <h2 className="tibi-section-title mb-3">Cycle vs previous</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="tibi-label">{comparison.current.name}</div>
              <div className="tibi-stat">{formatXOF(comparison.current.gmv_xof)}</div>
            </div>
            <div>
              <div className="tibi-label">{comparison.previous?.name ?? 'No previous cycle'}</div>
              <div className="tibi-stat">{comparison.previous ? formatXOF(comparison.previous.gmv_xof) : '—'}</div>
              {diff != null && (
                <div className={`text-[12px] mt-1 ${diff >= 0 ? 'text-success-fg' : 'text-danger-fg'}`}>
                  {diff >= 0 ? '+' : ''}{formatXOF(diff)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <ReportTable
        title="Low-stock alerts"
        subtitle={`≤ ${inventory.alert_threshold} units`}
        rows={inventory.low_stock}
        columns={[
          { key: 'sku', label: 'SKU', mono: true, muted: true },
          { key: 'product', label: 'Item' },
          { key: 'brand', label: 'Brand', muted: true },
          { key: 'stock_qty', label: 'Stock', align: 'right' },
        ]}
        csv={() => csvOf('low-stock.csv', inventory.low_stock)}
      />
    </>
  );
}

function WholesaleTab({ wholesale, csvOf }: { wholesale: WholesaleReport; csvOf: (filename: string, rows: any[]) => void }) {
  return (
    <>
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="tibi-card flex flex-col gap-3">
          <h2 className="tibi-section-title">Wholesale</h2>
          <p className="text-[12px] text-ink-hint">Acheté par Tibi puis revendu.</p>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><div className="tibi-label">Stock value (cost)</div><div className="font-medium">{formatXOF(wholesale.wholesale.stock_value_cost_xof)}</div></div>
            <div><div className="tibi-label">Stock value (retail)</div><div className="font-medium">{formatXOF(wholesale.wholesale.stock_value_retail_xof)}</div></div>
            <div><div className="tibi-label">Sales</div><div className="font-medium">{formatXOF(wholesale.wholesale.sales_xof)}</div></div>
            <div><div className="tibi-label">COGS</div><div className="font-medium">{formatXOF(wholesale.wholesale.cogs_xof)}</div></div>
            <div className="col-span-2">
              <div className="tibi-label">Gross margin</div>
              <div className="tibi-stat">{formatXOF(wholesale.wholesale.gross_margin_xof)}</div>
              <div className="text-[11px] text-ink-hint">{formatPercent(wholesale.wholesale.gross_margin_pct, 1)}</div>
            </div>
          </div>
        </div>

        <div className="tibi-card flex flex-col gap-3">
          <h2 className="tibi-section-title">Tibi Editions</h2>
          <p className="text-[12px] text-ink-hint">Produits Tibi — marge totale pour Tibi.</p>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><div className="tibi-label">Stock value (cost)</div><div className="font-medium">{formatXOF(wholesale.own_label.stock_value_cost_xof)}</div></div>
            <div><div className="tibi-label">Stock value (retail)</div><div className="font-medium">{formatXOF(wholesale.own_label.stock_value_retail_xof)}</div></div>
            <div><div className="tibi-label">Sales</div><div className="font-medium">{formatXOF(wholesale.own_label.sales_xof)}</div></div>
            <div><div className="tibi-label">COGS</div><div className="font-medium">{formatXOF(wholesale.own_label.cogs_xof)}</div></div>
            <div className="col-span-2">
              <div className="tibi-label">Gross margin</div>
              <div className="tibi-stat">{formatXOF(wholesale.own_label.gross_margin_xof)}</div>
              <div className="text-[11px] text-ink-hint">{formatPercent(wholesale.own_label.gross_margin_pct, 1)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="tibi-card">
        <h2 className="tibi-section-title">Profit total (Wholesale + Editions)</h2>
        <div className="tibi-stat mt-2">{formatXOF(wholesale.profit_total_xof)}</div>
      </section>

      <ReportTable
        title="Gross margin by brand"
        rows={wholesale.by_brand}
        columns={[
          { key: 'brand', label: 'Brand' },
          { key: 'type', label: 'Type' },
          { key: 'sales', label: 'Sales', align: 'right', format: formatXOF },
          { key: 'cogs', label: 'COGS', align: 'right', format: formatXOF },
          { key: 'margin', label: 'Margin', align: 'right', format: formatXOF },
          { key: 'margin_pct', label: '%', align: 'right', format: (v: number) => formatPercent(v, 0) },
        ]}
        csv={() => csvOf('wholesale-by-brand.csv', wholesale.by_brand)}
      />
    </>
  );
}

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  muted?: boolean;
  mono?: boolean;
  format?: (value: any) => string;
}

function ReportTable({ title, subtitle, rows, columns, csv, footer }: {
  title: string;
  subtitle?: string;
  rows: any[];
  columns: Column[];
  csv: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <section className="tibi-card p-0 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="tibi-section-title">{title}</h2>
          {subtitle && <p className="text-[11px] text-ink-hint mt-1">{subtitle}</p>}
        </div>
        {rows.length > 0 && <button onClick={csv} className="text-[11px] text-ink-secondary hover:text-ink">Export CSV</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="tibi-table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'text-right' : ''}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-ink-hint py-6">No data.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => {
                  const v = r[c.key];
                  const display = c.format ? c.format(v) : v ?? '—';
                  return (
                    <td key={c.key} className={[
                      c.align === 'right' ? 'text-right' : '',
                      c.muted ? 'text-ink-secondary' : '',
                      c.mono ? 'font-mono text-[11px]' : '',
                    ].filter(Boolean).join(' ')}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="px-5 py-3 border-t border-hairline border-divider text-right">{footer}</div>}
    </section>
  );
}
