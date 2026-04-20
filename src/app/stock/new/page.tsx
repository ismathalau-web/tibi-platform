import { listBrands } from '@/lib/data/brands';
import { requireUser } from '@/lib/auth';
import { AddItemForm } from '@/app/admin/stock/new/add-item-form';

export const metadata = { title: 'Add item' };

export default async function NewItemPage() {
  const [user, brands] = await Promise.all([requireUser(), listBrands()]);
  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <header>
        <h1 className="tibi-page-title">Add item</h1>
        <p className="text-[12px] text-ink-hint mt-2">
          Create a product with one or more variants. SKUs are generated automatically.
        </p>
      </header>
      <AddItemForm brands={brands} hideCost={user.role !== 'admin'} />
    </div>
  );
}
