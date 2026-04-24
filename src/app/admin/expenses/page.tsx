import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { ExpensesView } from './expenses-view';

export const metadata = { title: 'Expenses' };
export const dynamic = 'force-dynamic';

export default async function ExpensesPage({ searchParams }: { searchParams: { month?: string; division?: string; category?: string } }) {
  const user = await getCurrentUser();
  const supabase = createAdminClient();

  // Default: current month
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = searchParams.month ?? defaultMonth;
  const [y, m] = month.split('-').map(Number);
  const since = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const until = new Date(y, m, 0).toISOString().slice(0, 10);

  let q = supabase
    .from('expenses')
    .select('id, incurred_on, amount_xof, division, category, payment_method, description, recorded_by, created_at')
    .gte('incurred_on', since)
    .lte('incurred_on', until)
    .order('incurred_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (searchParams.division) q = q.eq('division', searchParams.division);
  if (searchParams.category) q = q.eq('category', searchParams.category);

  const { data } = await q;
  const expenses = (data ?? []) as Array<{
    id: string;
    incurred_on: string;
    amount_xof: number;
    division: 'boutique' | 'cafe' | 'shared';
    category: string;
    payment_method: string;
    description: string | null;
    recorded_by: string | null;
    created_at: string;
  }>;

  return (
    <ExpensesView
      expenses={expenses}
      isAdmin={user?.role === 'admin'}
      currentMonth={month}
      currentDivision={searchParams.division ?? 'all'}
      currentCategory={searchParams.category ?? 'all'}
    />
  );
}
