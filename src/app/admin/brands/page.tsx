import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandTypeBadge, Badge } from '@/components/ui/badge';
import { listBrandsWithStats } from '@/lib/data/brands';
import { formatXOF } from '@/lib/format';

export const metadata = { title: 'Brands' };
export const dynamic = 'force-dynamic';

export default async function BrandsPage() {
  const rows = await listBrandsWithStats();

  const consignment = rows.filter((r) => r.brand.type === 'consignment');
  const wholesale = rows.filter((r) => r.brand.type === 'wholesale');
  const ownLabel = rows.filter((r) => r.brand.type === 'own_label');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="tibi-page-title">Brands</h1>
          <p className="text-[12px] text-ink-hint mt-1">{rows.length} active</p>
        </div>
        <Link href="/admin/brands/new">
          <Button>Add brand</Button>
        </Link>
      </header>

      {[
        { label: 'Own label', list: ownLabel },
        { label: 'Wholesale', list: wholesale },
        { label: 'Consignment', list: consignment },
      ].map((g) =>
        g.list.length === 0 ? null : (
          <section key={g.label} className="tibi-card p-0 overflow-hidden">
            <div className="px-5 py-4">
              <h2 className="tibi-section-title">{g.label} <span className="text-[12px] text-ink-hint font-normal">· {g.list.length}</span></h2>
            </div>
            <div className="overflow-x-auto">
              <table className="tibi-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Country</th>
                    <th>Category</th>
                    <th className="text-right">Commission</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Sold</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {g.list.map((r) => (
                    <tr key={r.brand.id}>
                      <td>
                        <Link href={`/admin/brands/${r.brand.id}`} className="hover:underline flex items-center gap-2">
                          {r.brand.name}
                          <BrandTypeBadge type={r.brand.type} />
                        </Link>
                      </td>
                      <td className="text-ink-secondary">{r.brand.country ?? '—'}</td>
                      <td className="text-ink-secondary">{r.brand.category ?? '—'}</td>
                      <td className="text-right">
                        {r.brand.type === 'consignment'
                          ? r.brand.commission_pct != null
                            ? `${r.brand.commission_pct}%`
                            : '—'
                          : '—'}
                      </td>
                      <td className="text-right">{r.stock}</td>
                      <td className="text-right">{r.sold}</td>
                      <td className="text-right">{r.brand.type === 'consignment' ? formatXOF(r.balance_due_xof) : '—'}</td>
                      <td>
                        {r.brand.type === 'consignment' && r.brand.commission_status === 'pending' ? (
                          <Badge tone="warning">Pending</Badge>
                        ) : (
                          <Badge tone="success">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}
    </div>
  );
}
