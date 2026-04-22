'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createItem, type FormState } from '../actions';
import { brandCode } from '@/lib/sku';
import type { Brand } from '@/lib/supabase/types';

interface Props {
  brands: Brand[];
  hideCost?: boolean;
}

interface Row {
  size: string;
  color: string;
  retail_price_xof: string;
  wholesale_cost_xof: string;
  stock_qty: string;
}

const emptyRow = (): Row => ({ size: '', color: '', retail_price_xof: '', wholesale_cost_xof: '', stock_qty: '1' });

export function AddItemForm({ brands, hideCost = false }: Props) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [state, setState] = useState<FormState>({ ok: false });
  const [isPending, start] = useTransition();

  const selectedBrand = useMemo(() => brands.find((b) => b.id === brandId), [brands, brandId]);
  const needsCost = !hideCost && selectedBrand && selectedBrand.type !== 'consignment';

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await createItem(state, fd);
        if (!res) return;
        setState(res);
        if (res.ok && res.redirectTo) {
          router.push(res.redirectTo);
        }
      } catch (err: unknown) {
        setState({ ok: false, error: err instanceof Error ? err.message : 'Save failed' });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="tibi-card flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5">
          <Select label="Brand" name="brand_id" value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Input label="Category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Fashion, Beauty…" />
        </div>
        <Input
          label="Product name"
          name="product_name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
        />
        {selectedBrand && (
          <p className="text-[11px] text-ink-hint">
            Brand code: <span className="font-mono">{brandCode(selectedBrand.name)}</span> ·
            {selectedBrand.type === 'consignment'
              ? ' Consignment — cost price hidden.'
              : ' Wholesale/own-label — cost price required for margin calculation.'}
          </p>
        )}
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="tibi-section-title">Variants</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
          >
            + Add variant
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Color</th>
                <th className="text-right">Retail XOF</th>
                {needsCost && <th className="text-right">Cost XOF</th>}
                <th className="text-right">Qty</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-2">
                    <input
                      name={`variants[${i}].size`}
                      value={r.size}
                      onChange={(e) => updateRow(i, { size: e.target.value })}
                      placeholder="S, M, 38…"
                      className="tibi-input h-8"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      name={`variants[${i}].color`}
                      value={r.color}
                      onChange={(e) => updateRow(i, { color: e.target.value })}
                      placeholder="Noir"
                      className="tibi-input h-8"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      name={`variants[${i}].retail_price_xof`}
                      value={r.retail_price_xof}
                      onChange={(e) => updateRow(i, { retail_price_xof: e.target.value })}
                      required
                      className="tibi-input h-8 text-right w-32"
                    />
                  </td>
                  {needsCost && (
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        name={`variants[${i}].wholesale_cost_xof`}
                        value={r.wholesale_cost_xof}
                        onChange={(e) => updateRow(i, { wholesale_cost_xof: e.target.value })}
                        className="tibi-input h-8 text-right w-32"
                      />
                    </td>
                  )}
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name={`variants[${i}].stock_qty`}
                      value={r.stock_qty}
                      onChange={(e) => updateRow(i, { stock_qty: e.target.value })}
                      required
                      className="tibi-input h-8 text-right w-20"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => {
                          const dup = { ...prev[i] };
                          return [...prev.slice(0, i + 1), dup, ...prev.slice(i + 1)];
                        })}
                        className="text-[11px] text-ink-secondary hover:text-ink"
                      >
                        Duplicate
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-[11px] text-ink-secondary hover:text-danger-fg"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {state.error && <div className="text-[12px] text-danger-fg">{state.error}</div>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save item'}
        </Button>
      </div>
    </form>
  );
}
