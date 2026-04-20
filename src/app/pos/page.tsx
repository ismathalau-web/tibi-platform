import { loadPosCatalog, listActiveEmployees } from '@/lib/data/pos';
import { createAdminClient } from '@/lib/supabase/admin';
import { PosScreen } from './pos-screen';

export const metadata = { title: 'POS' };
export const dynamic = 'force-dynamic';

interface SearchParams { preorder?: string }

async function isTodayClosed(): Promise<boolean> {
  const supabase = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('sales')
    .select('id')
    .gte('created_at', todayStart.toISOString())
    .eq('is_locked', true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export default async function PosPage({ searchParams }: { searchParams: SearchParams }) {
  const [catalog, employees, todayClosed] = await Promise.all([
    loadPosCatalog(),
    listActiveEmployees(),
    isTodayClosed(),
  ]);

  let preorderSeed = null as null | {
    id: string;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    deposit_xof: number;
    items: Array<{ variant_id: string; qty: number; unit_price_xof: number }>;
  };

  if (searchParams.preorder) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('preorders')
      .select('id, customer_name, customer_email, customer_phone, deposit_xof, preorder_items(variant_id, qty, unit_price_xof)')
      .eq('id', searchParams.preorder)
      .maybeSingle();
    if (data) {
      preorderSeed = {
        id: (data as any).id,
        customer_name: (data as any).customer_name ?? '',
        customer_email: (data as any).customer_email ?? null,
        customer_phone: (data as any).customer_phone ?? null,
        deposit_xof: (data as any).deposit_xof ?? 0,
        items: ((data as any).preorder_items ?? []) as Array<{ variant_id: string; qty: number; unit_price_xof: number }>,
      };
    }
  }

  return <PosScreen catalog={catalog} employees={employees} preorderSeed={preorderSeed} todayClosed={todayClosed} />;
}
