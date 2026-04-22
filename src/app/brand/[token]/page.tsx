import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { BrandSummary } from '@/lib/supabase/types';
import { BrandDashboard } from './brand-dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brand dashboard' };

export default async function BrandView({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();

  const [summaryRes, stockRes, paymentsRes, salesDetailRes, ratesRes] = await Promise.all([
    supabase.rpc('brand_summary', { p_token: params.token }),
    supabase.rpc('brand_stock', { p_token: params.token }),
    supabase.rpc('brand_payment_history', { p_token: params.token }),
    supabase.rpc('brand_sales_detail', { p_token: params.token }),
    supabase.from('exchange_rates').select('currency_code, rate_to_xof'),
  ]);

  if (summaryRes.error || !summaryRes.data) notFound();
  const summary = summaryRes.data as BrandSummary;

  return (
    <BrandDashboard
      summary={summary}
      stock={(stockRes.data as Array<Record<string, unknown>>) ?? []}
      payments={(paymentsRes.data as Array<Record<string, unknown>>) ?? []}
      salesDetail={(salesDetailRes.data as Array<Record<string, unknown>>) ?? []}
      rates={(ratesRes.data as Array<{ currency_code: string; rate_to_xof: number }>) ?? []}
      token={params.token}
    />
  );
}
