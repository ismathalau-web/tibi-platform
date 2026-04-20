import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { listVariants } from '@/lib/data/variants';
import { listBrands } from '@/lib/data/brands';
import { StockListClient } from '@/app/admin/stock/stock-list-client';
import type { BrandType, VariantStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Stock' };
export const dynamic = 'force-dynamic';

interface SearchParams {
  brand?: string;
  type?: BrandType;
  status?: VariantStatus;
  category?: string;
}

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, variants, brands] = await Promise.all([
    requireUser(),
    listVariants({
      brandId: searchParams.brand,
      type: searchParams.type,
      status: searchParams.status,
      category: searchParams.category,
    }),
    listBrands(),
  ]);

  const categories = Array.from(
    new Set(variants.map((v) => v.product.category).filter(Boolean)),
  ) as string[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Stock</h1>
          <p className="text-[12px] text-ink-hint mt-1">{variants.length} variants</p>
        </div>
      </header>

      <form method="get" className="tibi-card flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Brand</label>
          <select name="brand" defaultValue={searchParams.brand ?? ''} className="tibi-input w-48">
            <option value="">All brands</option>
            {brands.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Type</label>
          <select name="type" defaultValue={searchParams.type ?? ''} className="tibi-input w-36">
            <option value="">All types</option>
            <option value="consignment">Consignment</option>
            <option value="wholesale">Wholesale</option>
            <option value="own_label">Own Label</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Status</label>
          <select name="status" defaultValue={searchParams.status ?? ''} className="tibi-input w-36">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Category</label>
          <select name="category" defaultValue={searchParams.category ?? ''} className="tibi-input w-40">
            <option value="">All</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <StockListClient variants={variants} canAdjust={user.role === 'admin'} />
    </div>
  );
}
