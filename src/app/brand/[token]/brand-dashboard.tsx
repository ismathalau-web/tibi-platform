'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ZoomableImage } from '@/components/ui/image-lightbox';
import { formatXOF, formatCurrency, formatDate } from '@/lib/format';
import type { BrandSummary } from '@/lib/supabase/types';

interface StockRow {
  variant_id: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  retail_price_xof: number;
  photo_url: string | null;
  qty_sent: number;
  qty_sold: number;
  qty_remaining: number;
  status: 'in_stock' | 'sold' | string;
}

interface PaymentRow {
  cycle_name: string;
  start_date: string;
  end_date: string;
  amount_xof: number;
  paid_at: string;
}

interface SaleDetailRow {
  sale_item_id: string;
  sold_at: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  qty_sold: number;
  unit_price_xof: number;
  unit_brand_share_xof: number;
  total_brand_share_xof: number;
}

interface Props {
  summary: BrandSummary;
  stock: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  salesDetail: Array<Record<string, unknown>>;
  rates: Array<{ currency_code: string; rate_to_xof: number }>;
  token: string;
}

export function BrandDashboard({ summary: initialSummary, stock: initialStock, payments: initialPayments, salesDetail: initialSalesDetail, rates, token }: Props) {
  const [summary, setSummary] = useState<BrandSummary>(initialSummary);
  const [stock, setStock] = useState<StockRow[]>(initialStock as unknown as StockRow[]);
  const [payments, setPayments] = useState<PaymentRow[]>(initialPayments as unknown as PaymentRow[]);
  const [salesDetail, setSalesDetail] = useState<SaleDetailRow[]>(initialSalesDetail as unknown as SaleDetailRow[]);
  const [filter, setFilter] = useState<'all' | 'in_stock' | 'sold'>('all');

  const rate = useMemo(() => {
    if (summary.brand.currency === 'XOF') return 1;
    const r = rates.find((x) => x.currency_code === summary.brand.currency);
    return r ? r.rate_to_xof : 1;
  }, [rates, summary.brand.currency]);

  function fmtMoney(xof: number) {
    if (summary.brand.currency === 'XOF') return formatXOF(xof);
    return formatCurrency(xof / rate, summary.brand.currency);
  }

  // Realtime refresh on variant/sale_item changes for this brand's token.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`brand-${token}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, async () => {
        await refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, async () => {
        await refetch();
      })
      .subscribe();

    async function refetch() {
      const [s, st, p, sd] = await Promise.all([
        supabase.rpc('brand_summary', { p_token: token }),
        supabase.rpc('brand_stock', { p_token: token }),
        supabase.rpc('brand_payment_history', { p_token: token }),
        supabase.rpc('brand_sales_detail', { p_token: token }),
      ]);
      if (s.data) setSummary(s.data as unknown as BrandSummary);
      if (st.data) setStock(st.data as unknown as StockRow[]);
      if (p.data) setPayments(p.data as unknown as PaymentRow[]);
      if (sd.data) setSalesDetail(sd.data as unknown as SaleDetailRow[]);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  const sellThrough = summary.stats.sent > 0 ? (summary.stats.sold / summary.stats.sent) * 100 : 0;

  const filteredStock = stock.filter((r) => (filter === 'all' ? true : r.status === filter));

  return (
    <main className="min-h-dvh bg-bg p-5 md:p-10">
      <div className="mx-auto max-w-[980px] flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="text-[15px] font-medium tracking-[0.18em] text-ink">TIBI</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="tibi-page-title">{summary.brand.name}</h1>
            {summary.brand.commission_status === 'pending' && <Badge tone="warning">Commission pending</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-secondary">
            {summary.brand.country && <span>{summary.brand.country}</span>}
            {summary.cycle && <Badge tone="neutral">{summary.cycle.name}</Badge>}
            {summary.brand.commission_pct != null && <span>Commission: {summary.brand.commission_pct}%</span>}
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Items Sent" value={summary.stats.sent} />
          <StatCard label="Items Sold" value={summary.stats.sold} />
          <StatCard label="Items Remaining" value={summary.stats.remaining} />
          <StatCard label="Balance Due" value={fmtMoney(summary.stats.balance_due_xof)} />
        </section>

        <section className="tibi-card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="tibi-label">Sell-through</span>
            <span className="text-[12px] text-ink-secondary">{sellThrough.toFixed(0)}%</span>
          </div>
          <Progress value={sellThrough} />
        </section>

        <section className="tibi-card p-0 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="tibi-section-title">Stock</h2>
            <div className="flex gap-2">
              {(['all', 'in_stock', 'sold'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[11px] px-3 h-7 rounded-pill border-hairline border ${filter === f ? 'bg-ink text-white border-ink' : 'border-border text-ink-secondary'}`}
                >
                  {f === 'all' ? 'All' : f === 'in_stock' ? 'In stock' : 'Sold out'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="tibi-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>Photo</th>
                  <th>Item</th>
                  <th className="text-ink-hint">Variant</th>
                  <th className="text-right whitespace-nowrap">Retail price</th>
                  <th className="text-right whitespace-nowrap">Your share / unit</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Sold</th>
                  <th className="text-right">Left</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-ink-hint py-8">No items.</td></tr>
                ) : filteredStock.map((r) => {
                  const commissionPct = summary.brand.commission_pct ?? 0;
                  const yourShare = Math.round(r.retail_price_xof * (1 - commissionPct / 100));
                  return (
                    <tr key={r.variant_id}>
                      <td>
                        {r.photo_url ? (
                          <ZoomableImage src={r.photo_url} className="w-10 h-10 rounded-input object-cover border-hairline border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-input bg-surface" />
                        )}
                      </td>
                      <td>
                        <div>{r.product_name}</div>
                        <div className="font-mono text-[10px] text-ink-hint mt-0.5">{r.sku}</div>
                      </td>
                      <td className="text-ink-secondary text-[12px]">
                        {[r.size, r.color].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">{fmtMoney(r.retail_price_xof)}</td>
                      <td className="text-right text-ink-secondary whitespace-nowrap tabular-nums">{fmtMoney(yourShare)}</td>
                      <td className="text-right tabular-nums">{r.qty_sent}</td>
                      <td className="text-right tabular-nums">{r.qty_sold}</td>
                      <td className="text-right tabular-nums">{r.qty_remaining}</td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredStock.length > 0 && (
                <tfoot>
                  <tr className="border-t border-hairline border-divider font-medium">
                    <td colSpan={5} className="text-right text-[12px] text-ink-secondary">Total</td>
                    <td className="text-right tabular-nums">{filteredStock.reduce((s, r) => s + r.qty_sent, 0)}</td>
                    <td className="text-right tabular-nums">{filteredStock.reduce((s, r) => s + r.qty_sold, 0)}</td>
                    <td className="text-right tabular-nums">{filteredStock.reduce((s, r) => s + r.qty_remaining, 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <section className="tibi-card p-0 overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="tibi-section-title">Sales detail</h2>
            <p className="text-[11px] text-ink-hint mt-1">
              Each individual sale {summary.cycle ? `for ${summary.cycle.name}` : ''}.
              <strong> Retail price</strong> = customer paid · <strong>Your share</strong> = what Tibi owes you.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tibi-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Retail / unit</th>
                  <th className="text-right">Your share / unit</th>
                  <th className="text-right">Total your share</th>
                </tr>
              </thead>
              <tbody>
                {salesDetail.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-ink-hint py-8">No sales yet for this cycle.</td></tr>
                ) : salesDetail.map((s) => (
                  <tr key={s.sale_item_id}>
                    <td className="text-ink-secondary text-[12px]">
                      {new Date(s.sold_at).toLocaleString('en', { dateStyle: 'short' })}
                    </td>
                    <td>
                      {s.product_name}
                      <div className="text-[11px] text-ink-hint mt-0.5">
                        {[s.sku, s.size, s.color].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="text-right">{s.qty_sold}</td>
                    <td className="text-right">{fmtMoney(s.unit_price_xof)}</td>
                    <td className="text-right text-ink-secondary">{fmtMoney(s.unit_brand_share_xof)}</td>
                    <td className="text-right font-medium">{fmtMoney(s.total_brand_share_xof)}</td>
                  </tr>
                ))}
              </tbody>
              {salesDetail.length > 0 && (
                <tfoot>
                  <tr className="border-t border-hairline border-divider font-medium">
                    <td colSpan={2} className="text-right text-[12px] text-ink-secondary">Total</td>
                    <td className="text-right">{salesDetail.reduce((s, x) => s + x.qty_sold, 0)}</td>
                    <td colSpan={2}></td>
                    <td className="text-right">{fmtMoney(salesDetail.reduce((s, x) => s + x.total_brand_share_xof, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <section className="tibi-card p-0 overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="tibi-section-title">Payment history</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tibi-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Dates</th>
                  <th>Paid on</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-ink-hint py-6">No payments yet.</td></tr>
                ) : payments.map((p, i) => (
                  <tr key={i}>
                    <td>{p.cycle_name}</td>
                    <td className="text-ink-secondary">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                    <td className="text-ink-secondary">{formatDate(p.paid_at)}</td>
                    <td className="text-right">{fmtMoney(p.amount_xof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tibi-card flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="tibi-section-title">Cycle report</h2>
            <p className="text-[12px] text-ink-hint mt-1">Download a summary for your records.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={`/api/brand/${token}/report`} target="_blank" rel="noreferrer" className="tibi-btn tibi-btn-secondary">Download PDF</a>
            <a href={`/api/brand/${token}/report-csv`} className="tibi-btn tibi-btn-secondary">Download CSV</a>
          </div>
        </section>

        <footer className="text-center text-[11px] text-ink-hint pt-4">
          Questions? <a href="mailto:hello@ismathlauriano.com" className="text-ink underline">hello@ismathlauriano.com</a>
        </footer>
      </div>
    </main>
  );
}
