import { getTodayClose } from '@/lib/data/reports';
import { createAdminClient } from '@/lib/supabase/admin';
import { CloseDayView } from './close-day-view';

export const metadata = { title: 'Daily close' };
export const dynamic = 'force-dynamic';

async function isTodayAlreadyClosed(): Promise<boolean> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('sales')
    .select('id')
    .gte('created_at', since.toISOString())
    .eq('is_locked', true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export default async function DailyClosePage() {
  const [data, alreadyClosed] = await Promise.all([getTodayClose(), isTodayAlreadyClosed()]);
  return <CloseDayView data={data} alreadyClosed={alreadyClosed} />;
}
