import { loadPosCatalog } from '@/lib/data/pos';
import { listBrands } from '@/lib/data/brands';
import { PreorderClient } from './preorder-client';

export const metadata = { title: 'Pre-order' };
export const dynamic = 'force-dynamic';

export default async function PreorderPage() {
  const [catalog, brands] = await Promise.all([loadPosCatalog(), listBrands()]);
  return (
    <div className="p-5 max-w-[780px] mx-auto">
      <h1 className="tibi-page-title mb-6">New pre-order</h1>
      <PreorderClient catalog={catalog} brands={brands} />
    </div>
  );
}
