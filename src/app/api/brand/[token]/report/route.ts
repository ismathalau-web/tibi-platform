import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createAdminClient } from '@/lib/supabase/admin';
import { BrandReportPdf } from '@/lib/pdf/brand-report-pdf';
import { safeFilename } from '@/lib/safe-filename';
import type { BrandSummary } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

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

  const buffer = await renderToBuffer(
    BrandReportPdf({
      brandName: summary.brand.name,
      cycleName: summary.cycle?.name ?? null,
      commissionPct: summary.brand.commission_pct,
      sent: summary.stats.sent,
      sold: summary.stats.sold,
      remaining: summary.stats.remaining,
      balanceDueXof: summary.stats.balance_due_xof,
      paidXof: summary.stats.paid_xof,
      stock,
      salesDetail,
      date: new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date()),
    }) as any,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-${safeFilename(summary.brand.name)}-report.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
