import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { ReceptionBoard } from './reception-board';

export const metadata = { title: 'Receptions' };
export const dynamic = 'force-dynamic';

export default async function ReceptionsPage() {
  await requireUser();
  const supabase = createClient();

  // Fetch all stock_movements then filter in JS — PostgREST doesn't compare two columns directly.
  const { data } = await supabase
    .from('stock_movements')
    .select(`
      id, qty_sent, qty_confirmed, qty_returned, created_at,
      brand_id,
      brands!inner(id, name, country, commission_pct, commission_status),
      variants!inner(id, sku, size, color, retail_price_xof, photo_url, products!inner(name))
    `)
    .order('created_at', { ascending: true });

  const rows = ((data ?? []) as any[])
    .filter((r) => r.qty_confirmed < r.qty_sent)
    .map((r) => ({
      id: r.id,
      qty_sent: r.qty_sent,
      qty_confirmed: r.qty_confirmed,
      created_at: r.created_at,
      brand: {
        id: r.brands.id,
        name: r.brands.name,
        country: r.brands.country,
        commission_pct: r.brands.commission_pct,
        commission_status: r.brands.commission_status,
      },
      variant: {
        id: r.variants.id,
        sku: r.variants.sku,
        size: r.variants.size,
        color: r.variants.color,
        retail_price_xof: r.variants.retail_price_xof,
        photo_url: r.variants.photo_url,
        product_name: r.variants.products.name,
      },
    }));

  const byBrand = new Map<string, { brand: typeof rows[number]['brand']; items: typeof rows }>();
  for (const r of rows) {
    const g = byBrand.get(r.brand.id) ?? { brand: r.brand, items: [] as typeof rows };
    g.items.push(r);
    byBrand.set(r.brand.id, g);
  }
  const groups = Array.from(byBrand.values());

  return <ReceptionBoard groups={groups} />;
}
