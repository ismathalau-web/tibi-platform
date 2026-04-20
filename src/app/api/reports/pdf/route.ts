import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireAdmin } from '@/lib/auth';
import { getSalesReport, getBrandsReport, getInventoryReport, getWholesaleReport, type TimeBucket } from '@/lib/data/reports';
import { ReportsPdf } from '@/lib/pdf/reports-pdf';

export const dynamic = 'force-dynamic';

const allowed: TimeBucket[] = ['day', 'week', 'month', 'cycle', 'year'];

export async function GET(req: NextRequest) {
  await requireAdmin();
  const bucket = (allowed.includes(req.nextUrl.searchParams.get('range') as TimeBucket)
    ? (req.nextUrl.searchParams.get('range') as TimeBucket)
    : 'cycle') as TimeBucket;

  const [sales, brands, inventory, wholesale] = await Promise.all([
    getSalesReport(bucket),
    getBrandsReport(),
    getInventoryReport(),
    getWholesaleReport(),
  ]);

  const buffer = await renderToBuffer(
    ReportsPdf({
      sales,
      brands,
      inventory,
      wholesale,
      generatedOn: new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()),
    }) as any,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-reports-${bucket}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
