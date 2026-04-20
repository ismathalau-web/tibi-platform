'use client';

import { useMemo, useState, useTransition } from 'react';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatXOF } from '@/lib/format';
import { createPreorder, quickAddVariant } from '@/app/admin/preorders/actions';
import type { PosItem } from '@/lib/data/pos';
import type { Brand } from '@/lib/supabase/types';

interface Line {
  variant_id: string;
  product_name: string;
  brand_name: string;
  size: string | null;
  color: string | null;
  sku: string;
  qty: number;
  unit_price_xof: number;
}

export function PreorderClient({ catalog: initialCatalog, brands }: { catalog: PosItem[]; brands: Brand[] }) {
  const [catalog, setCatalog] = useState<PosItem[]>(initialCatalog);
  const [query, setQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deposit, setDeposit] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);
  const [isPending, start] = useTransition();

  const visible = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return catalog
      .filter((it) => `${it.product_name} ${it.brand_name} ${it.sku}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [query, catalog]);

  function addLineFromCatalog(it: PosItem) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.variant_id === it.variant_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, {
        variant_id: it.variant_id,
        product_name: it.product_name,
        brand_name: it.brand_name,
        size: it.size,
        color: it.color,
        sku: it.sku,
        qty: 1,
        unit_price_xof: it.retail_price_xof,
      }];
    });
    setQuery('');
  }

  function changeLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price_xof, 0);
  const depositNum = parseInt(deposit || '0', 10) || 0;
  const balance = Math.max(0, total - depositNum);
  // Minimum deposit — keep in sync with the server-side constant in actions.ts
  const MIN_DEPOSIT_PCT = 30;
  const minDeposit = Math.ceil(total * (MIN_DEPOSIT_PCT / 100));
  const depositTooLow = total > 0 && depositNum < minDeposit;

  async function submit() {
    setErr(null);
    if (!customerName.trim()) return setErr('Customer name required.');
    if (!customerEmail.trim()) return setErr('Email required.');
    if (!customerPhone.trim()) return setErr('Phone required.');
    if (lines.length === 0) return setErr('Add at least one item.');
    if (depositTooLow) return setErr(`Deposit must be at least ${MIN_DEPOSIT_PCT}% of the total (${minDeposit.toLocaleString('en').replace(/,/g, ' ')} XOF).`);

    start(async () => {
      const res = await createPreorder({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        deposit_xof: depositNum,
        notes: notes || null,
        items: lines.map((l) => ({
          variant_id: l.variant_id,
          qty: l.qty,
          unit_price_xof: l.unit_price_xof,
        })),
      });
      if (!res.ok) return setErr(res.error ?? 'Save failed');
      setDone({ id: res.preorderId, total });
    });
  }

  if (done) {
    return (
      <div className="tibi-card flex flex-col items-center text-center gap-3 py-10">
        <Badge tone="success">Pre-order saved</Badge>
        <div className="tibi-stat">{formatXOF(done.total)}</div>
        <p className="text-[12px] text-ink-hint">Visible in Admin → Pre-orders. Mark as Ready when items arrive; then Collect when customer comes.</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>New pre-order</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Customer */}
      <div className="tibi-card flex flex-col gap-4">
        <h2 className="tibi-section-title">Customer</h2>
        <Input label="Full name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
          <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
        </div>
      </div>

      {/* Items */}
      <div className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2">
          <h2 className="tibi-section-title">Items <span className="text-[12px] text-ink-hint font-normal">· {lines.length}</span></h2>
          <Button type="button" variant="secondary" onClick={() => setShowQuickAdd(true)}>Quick add new item</Button>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-3">
          <Input
            label="Search catalog (incl. sold-out)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Item name, brand, SKU…"
          />
          {visible.length > 0 && (
            <ul className="border-hairline border border-border rounded-input divide-y divide-divider max-h-56 overflow-auto">
              {visible.map((it) => (
                <li key={it.variant_id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-hover flex items-center justify-between gap-3"
                    onClick={() => addLineFromCatalog(it)}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px]">{it.product_name}</div>
                      <div className="text-[11px] text-ink-secondary truncate">
                        {it.brand_name}{it.size ? ` · ${it.size}` : ''}{it.color ? ` · ${it.color}` : ''}
                      </div>
                    </div>
                    <div className="text-[12px] text-right shrink-0">
                      <div>{formatXOF(it.retail_price_xof)}</div>
                      <div className={`text-[10px] ${it.stock_qty <= 0 ? 'text-danger-fg' : 'text-ink-hint'}`}>
                        {it.stock_qty <= 0 ? 'Sold out' : `${it.stock_qty} left`}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Brand</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <div className="text-[13px]">{l.product_name}</div>
                    <div className="text-[11px] text-ink-secondary">
                      {l.size ? `${l.size} · ` : ''}{l.color ?? ''}<span className="font-mono text-ink-hint"> · {l.sku}</span>
                    </div>
                  </td>
                  <td className="text-ink-secondary">{l.brand_name}</td>
                  <td>
                    <input
                      type="number" min="1" step="1"
                      className="tibi-input h-8 w-16 text-right ml-auto block"
                      value={l.qty}
                      onChange={(e) => changeLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="100"
                      className="tibi-input h-8 w-28 text-right ml-auto block"
                      value={l.unit_price_xof}
                      onChange={(e) => changeLine(i, { unit_price_xof: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </td>
                  <td className="text-right">{formatXOF(l.qty * l.unit_price_xof)}</td>
                  <td className="text-right">
                    <button type="button" className="text-[11px] text-ink-secondary hover:text-danger-fg" onClick={() => removeLine(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals + notes */}
      <div className="tibi-card flex flex-col gap-4">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] text-ink-secondary">Total</span>
          <span className="tibi-stat">{formatXOF(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Deposit (min ${MIN_DEPOSIT_PCT}%)`}
            type="number"
            min="0"
            step="100"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            hint={total > 0 ? `Minimum ${formatXOF(minDeposit)}` : undefined}
          />
          <div>
            <div className="tibi-label mb-1.5">Balance to pay</div>
            <div className="tibi-input flex items-center justify-end font-medium">{formatXOF(balance)}</div>
          </div>
        </div>
        {depositTooLow && (
          <Badge tone="warning" className="self-start">
            Deposit below the {MIN_DEPOSIT_PCT}% minimum ({formatXOF(minDeposit)})
          </Badge>
        )}
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {err && <Badge tone="danger" className="self-start">{err}</Badge>}
        <Button onClick={submit} disabled={isPending || lines.length === 0}>
          {isPending ? 'Saving…' : 'Save pre-order'}
        </Button>
      </div>

      {showQuickAdd && (
        <QuickAddModal
          brands={brands}
          onClose={() => setShowQuickAdd(false)}
          onAdded={(v) => {
            setCatalog((prev) => [{
              variant_id: v.variant_id,
              product_id: '',
              brand_id: '',
              product_name: v.product_name,
              category: null,
              brand_name: v.brand_name,
              brand_type: 'consignment',
              commission_pct: null,
              sku: v.sku,
              size: v.size,
              color: v.color,
              retail_price_xof: v.retail_price_xof,
              stock_qty: 0,
            }, ...prev]);
            setLines((prev) => [...prev, {
              variant_id: v.variant_id,
              product_name: v.product_name,
              brand_name: v.brand_name,
              size: v.size,
              color: v.color,
              sku: v.sku,
              qty: 1,
              unit_price_xof: v.retail_price_xof,
            }]);
            setShowQuickAdd(false);
          }}
        />
      )}
    </div>
  );
}

function QuickAddModal({
  brands,
  onClose,
  onAdded,
}: {
  brands: Brand[];
  onClose: () => void;
  onAdded: (v: {
    variant_id: string;
    sku: string;
    retail_price_xof: number;
    product_name: string;
    brand_name: string;
    size: string | null;
    color: string | null;
  }) => void;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function save() {
    setErr(null);
    if (!brandId || !productName.trim() || !price) {
      return setErr('Brand, name and price required.');
    }
    start(async () => {
      const res = await quickAddVariant({
        brand_id: brandId,
        product_name: productName,
        category: null,
        size: size || null,
        color: color || null,
        retail_price_xof: Number(price),
      });
      if (!res.ok) return setErr(res.error ?? 'Save failed');
      onAdded(res.variant);
    });
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-bg rounded-card w-full max-w-[440px] p-6 flex flex-col gap-4">
        <div>
          <div className="tibi-label mb-1">Quick add item</div>
          <p className="text-[12px] text-ink-hint">Creates a new product with stock = 0 so it can be pre-ordered. You can print its label later.</p>
        </div>
        <Select label="Brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Input label="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Size (opt.)" value={size} onChange={(e) => setSize(e.target.value)} />
          <Input label="Color (opt.)" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <Input label="Price XOF" type="number" min="0" step="100" value={price} onChange={(e) => setPrice(e.target.value)} required />
        {err && <Badge tone="danger" className="self-start">{err}</Badge>}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Add & select'}</Button>
        </div>
      </div>
    </div>
  );
}
