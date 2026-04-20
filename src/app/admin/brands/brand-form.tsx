'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createBrand, updateBrand, type FormState } from './actions';
import type { Brand } from '@/lib/supabase/types';

interface Props {
  mode: 'create' | 'edit';
  brand?: Brand;
}

const currencies = ['XOF', 'NGN', 'GHS', 'MAD', 'USD', 'EUR'] as const;

export function BrandForm({ mode, brand }: Props) {
  const router = useRouter();
  const [type, setType] = useState<Brand['type']>(brand?.type ?? 'consignment');
  const [state, setState] = useState<FormState>({ ok: false });
  const [isPending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const action = mode === 'create' ? createBrand : updateBrand.bind(null, brand!.id);
        const res = await action(state, fd);
        if (!res) return;
        setState(res);
        if (res.ok) {
          setSaved(true);
          if (mode === 'create' && 'redirectTo' in res && typeof res.redirectTo === 'string') {
            router.push(res.redirectTo);
            return;
          }
          if (mode === 'edit') {
            setTimeout(() => setSaved(false), 2000);
            router.refresh();
          }
        }
      } catch (err: unknown) {
        setState({ ok: false, error: err instanceof Error ? err.message : 'Save failed' });
      }
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <Input
        label="Name"
        name="name"
        defaultValue={brand?.name ?? ''}
        required
        error={state.fieldErrors?.name}
      />
      <div className="grid grid-cols-2 gap-5">
        <Input label="Country" name="country" defaultValue={brand?.country ?? ''} placeholder="Bénin, Nigeria…" />
        <Input label="Category" name="category" defaultValue={brand?.category ?? ''} placeholder="Fashion, Beauty…" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Input label="Email" name="email" type="email" defaultValue={brand?.email ?? ''} error={state.fieldErrors?.email} />
        <Input label="Instagram" name="instagram" defaultValue={brand?.instagram ?? ''} placeholder="@handle" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Select label="Type" name="type" value={type} onChange={(e) => setType(e.target.value as Brand['type'])}>
          <option value="consignment">Consignment</option>
          <option value="wholesale">Wholesale</option>
          <option value="own_label">Own Label</option>
        </Select>
        <Select label="Currency" name="currency" defaultValue={brand?.currency ?? 'XOF'}>
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      {type === 'consignment' && (
        <Input
          label="Commission %"
          name="commission_pct"
          type="number"
          step="0.5"
          min="0"
          max="100"
          defaultValue={brand?.commission_pct != null ? String(brand.commission_pct) : ''}
          placeholder="e.g. 27"
          hint="Leave empty if not yet confirmed with the brand."
          error={state.fieldErrors?.commission_pct}
        />
      )}
      <Textarea label="Notes" name="notes" rows={3} defaultValue={brand?.notes ?? ''} />

      {state.error && <div className="text-[12px] text-danger-fg">{state.error}</div>}
      {saved && mode === 'edit' && <div className="text-[12px] text-success-fg">Saved.</div>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : mode === 'create' ? 'Create brand' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
