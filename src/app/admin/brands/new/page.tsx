import { BrandForm } from '../brand-form';

export const metadata = { title: 'Add brand' };

export default function NewBrandPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[720px]">
      <header>
        <h1 className="tibi-page-title">Add brand</h1>
        <p className="text-[12px] text-ink-hint mt-2">
          Create a brand profile. Commission can be set now or later once confirmed with the brand.
        </p>
      </header>
      <BrandForm mode="create" />
    </div>
  );
}
