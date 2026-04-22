import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeFilename } from '@/lib/safe-filename';
import type { BrandSummary } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote if contains comma, quote, newline, or semicolon
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function line(...cells: unknown[]): string {
  return cells.map(esc).join(',');
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const [summaryRes, stockRes, salesDetailRes] = await Promise.all([
    supabase.rpc('brand_summary', { p_token: params.token }),
    supabase.rpc('brand_stock', { p_token: params.token }),
    supabase.rpc('brand_sales_detail', { p_token: params.token }),
  ]);

  if (summaryRes.error || !summaryRes.data) return new NextResponse('Not found', { status: 404 });
  const summary = summaryRes.data as BrandSummary;
  const stock = (stockRes.data ?? []) as Array<{
    product_name: string; sku: string; size: string | null; color: string | null;
    retail_price_xof: number; qty_sent: number; qty_sold: number; qty_remaining: number;
  }>;
  const salesDetail = (salesDetailRes.data ?? []) as Array<{
    sold_at: string; product_name: string; sku: string;
    size: string | null; color: string | null; qty_sold: number;
    unit_price_xof: number; unit_brand_share_xof: number; total_brand_share_xof: number;
  }>;

  const commissionPct = summary.brand.commission_pct ?? 0;
  const date = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
  const lines: string[] = [];

  // Header block
  lines.push(line('Tibi Concept Store — Brand report'));
  lines.push(line('Brand', summary.brand.name));
  lines.push(line('Cycle', summary.cycle?.name ?? ''));
  lines.push(line('Commission %', summary.brand.commission_pct ?? ''));
  lines.push(line('Report date', date));
  lines.push('');

  // Summary block
  lines.push(line('Cycle summary'));
  lines.push(line('Items sent', summary.stats.sent));
  lines.push(line('Items sold', summary.stats.sold));
  lines.push(line('Items remaining', summary.stats.remaining));
  lines.push(line('Balance due (XOF)', summary.stats.balance_due_xof));
  lines.push(line('Paid to date (XOF)', summary.stats.paid_xof));
  lines.push('');

  // Stock table
  lines.push(line('STOCK'));
  lines.push(line('Item', 'SKU', 'Size', 'Color', 'Retail price (XOF)', 'Your share / unit (XOF)', 'Sent', 'Sold', 'Remaining'));
  for (const r of stock) {
    const yourShare = Math.round(r.retail_price_xof * (1 - commissionPct / 100));
    lines.push(line(
      r.product_name,
      r.sku,
      r.size ?? '',
      r.color ?? '',
      r.retail_price_xof,
      yourShare,
      r.qty_sent,
      r.qty_sold,
      r.qty_remaining,
    ));
  }
  if (stock.length > 0) {
    lines.push(line(
      'TOTAL', '', '', '', '', '',
      stock.reduce((s, r) => s + r.qty_sent, 0),
      stock.reduce((s, r) => s + r.qty_sold, 0),
      stock.reduce((s, r) => s + r.qty_remaining, 0),
    ));
  }
  lines.push('');

  // Sales detail table (no invoice number — internal Tibi info, not for the brand)
  lines.push(line('SALES DETAIL'));
  lines.push(line(
    'Date', 'Item', 'SKU', 'Size', 'Color',
    'Qty', 'Retail / unit (XOF)', 'Your share / unit (XOF)', 'Total your share (XOF)',
  ));
  if (salesDetail.length === 0) {
    lines.push(line('— No sales yet for this cycle —'));
  } else {
    for (const s of salesDetail) {
      lines.push(line(
        new Date(s.sold_at).toISOString().slice(0, 10),
        s.product_name,
        s.sku,
        s.size ?? '',
        s.color ?? '',
        s.qty_sold,
        s.unit_price_xof,
        s.unit_brand_share_xof,
        s.total_brand_share_xof,
      ));
    }
    lines.push(line(
      'TOTAL', '', '', '', '',
      salesDetail.reduce((s, x) => s + x.qty_sold, 0),
      '', '',
      salesDetail.reduce((s, x) => s + x.total_brand_share_xof, 0),
    ));
  }

  // BOM for Excel UTF-8 compatibility
  const body = '\uFEFF' + lines.join('\r\n') + '\r\n';

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tibi-${safeFilename(summary.brand.name)}-report-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
