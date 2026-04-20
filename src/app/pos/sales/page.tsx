import { createAdminClient } from '@/lib/supabase/admin';
import { SalesHistoryTable } from './sales-history-table';

export const metadata = { title: 'Recent sales' };
export const dynamic = 'force-dynamic';

export default async function SalesHistoryPage() {
  const supabase = createAdminClient();
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, total_xof, payment_method, seller_name, customer_name, is_locked, voided_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (sales ?? []) as Array<{
    id: string;
    invoice_no: number;
    created_at: string;
    total_xof: number;
    payment_method: string;
    seller_name: string;
    customer_name: string | null;
    is_locked: boolean;
    voided_at: string | null;
  }>;

  return (
    <div className="p-5 max-w-[980px] mx-auto flex flex-col gap-5">
      <header>
        <h1 className="tibi-page-title">Recent sales</h1>
        <p className="text-[12px] text-ink-hint mt-1">Latest 50 · click a row to open details, return, exchange, edit</p>
      </header>
      <SalesHistoryTable rows={rows} />
    </div>
  );
}
