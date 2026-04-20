import Link from 'next/link';
import { getSalesReport, getBrandsReport, getInventoryReport, getWholesaleReport, type TimeBucket } from '@/lib/data/reports';
import { ReportsView } from './reports-view';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const allowed: TimeBucket[] = ['day', 'week', 'month', 'cycle', 'year'];

export default async function ReportsPage({ searchParams }: { searchParams: { range?: string; tab?: string } }) {
  const bucket: TimeBucket = allowed.includes(searchParams.range as TimeBucket) ? (searchParams.range as TimeBucket) : 'cycle';
  const tab = (['sales', 'brands', 'inventory', 'wholesale'].includes(searchParams.tab ?? '') ? searchParams.tab : 'sales') as 'sales' | 'brands' | 'inventory' | 'wholesale';

  const [sales, brandsReport, inventory, wholesale] = await Promise.all([
    getSalesReport(bucket),
    getBrandsReport(),
    getInventoryReport(),
    getWholesaleReport(),
  ]);

  return <ReportsView sales={sales} brands={brandsReport} inventory={inventory} wholesale={wholesale} tab={tab} bucket={bucket} />;
}
