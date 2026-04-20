import { getTodayClose } from '@/lib/data/reports';
import { CloseDayView } from '@/app/admin/reports/close/close-day-view';
import { requireUser } from '@/lib/auth';

export const metadata = { title: 'Daily close' };
export const dynamic = 'force-dynamic';

export default async function SellerCloseDayPage() {
  await requireUser();
  const data = await getTodayClose();
  return (
    <div className="p-5 max-w-[900px] mx-auto">
      <CloseDayView data={data} />
    </div>
  );
}
