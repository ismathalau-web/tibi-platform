import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadSaleDetail, loadSaleAuditLog } from '@/lib/data/sales';
import { listActiveEmployees } from '@/lib/data/pos';
import { SaleDetailView } from '@/app/admin/sales/[id]/sale-detail-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const sale = await loadSaleDetail(params.id);
  return { title: sale ? `Invoice #${sale.invoice_no}` : 'Sale' };
}

export default async function PosSaleDetailPage({ params }: { params: { id: string } }) {
  const [sale, audit, employees] = await Promise.all([
    loadSaleDetail(params.id),
    loadSaleAuditLog(params.id),
    listActiveEmployees(),
  ]);
  if (!sale) notFound();

  return (
    <div className="p-5 max-w-[980px] mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
        <Link href="/pos/sales" className="hover:text-ink">Sales</Link>
        <span>/</span>
        <span className="text-ink">#{sale.invoice_no}</span>
      </div>

      <SaleDetailView sale={sale} audit={audit} employees={employees} />
    </div>
  );
}
