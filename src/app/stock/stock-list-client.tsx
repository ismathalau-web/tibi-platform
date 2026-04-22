'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge, BrandTypeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { ZoomableImage } from '@/components/ui/image-lightbox';
import { formatXOF, formatDate } from '@/lib/format';
import type { VariantRow } from '@/lib/data/variants';
import { adjustVariantStock } from './adjust-action';
import { useRouter } from 'next/navigation';

interface Props { variants: VariantRow[]; canAdjust?: boolean }

export function StockListClient({ variants, canAdjust = false }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPrinting, setPrinting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adjustFor, setAdjustFor] = useState<VariantRow | null>(null);
  const [search, setSearch] = useState('');

  // Client-side search across SKU, product name, brand, size, color
  const filteredVariants = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) =>
      v.sku.toLowerCase().includes(q) ||
      v.product.name.toLowerCase().includes(q) ||
      v.brand.name.toLowerCase().includes(q) ||
      (v.size ?? '').toLowerCase().includes(q) ||
      (v.color ?? '').toLowerCase().includes(q),
    );
  })();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allSelected = filteredVariants.length > 0 && filteredVariants.every((v) => selected.has(v.id));
  function toggleAll() {
    if (allSelected) {
      // Deselect all currently visible
      const visibleIds = new Set(filteredVariants.map((v) => v.id));
      setSelected((prev) => new Set([...prev].filter((id) => !visibleIds.has(id))));
    } else {
      // Add all currently visible to the selection
      setSelected((prev) => new Set([...prev, ...filteredVariants.map((v) => v.id)]));
    }
  }

  async function printSelected() {
    if (selected.size === 0) return;
    setPrinting(true); setErr(null);
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }

  function exportCsv() {
    if (variants.length === 0) return;
    const rows = variants.map((v) => ({
      sku: v.sku,
      product: v.product.name,
      brand: v.brand.name,
      type: v.brand.type,
      size: v.size ?? '',
      color: v.color ?? '',
      price_xof: v.retail_price_xof,
      stock_qty: v.stock_qty,
      status: v.status,
    }));
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map((h) => JSON.stringify((r as any)[h] ?? '')).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tibi-stock.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by SKU, item, brand, size, color…"
          className="tibi-input flex-1 min-w-[240px] max-w-[440px]"
        />
        <span className="text-[12px] text-ink-secondary">
          {search ? `${filteredVariants.length} of ${variants.length}` : `${variants.length} item${variants.length === 1 ? '' : 's'}`}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={printSelected} disabled={selected.size === 0 || isPrinting}>
            {isPrinting ? 'Generating…' : `Print ${selected.size || ''} label${selected.size === 1 ? '' : 's'}`}
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={variants.length === 0}>Export CSV</Button>
          {canAdjust && (
            <Link href="/stock/history" className="text-[12px] text-ink-secondary hover:text-ink underline-offset-2 hover:underline">
              Adjustment history →
            </Link>
          )}
          <Link href="/stock/new"><Button>Add item</Button></Link>
        </div>
      </div>
      {err && <div className="text-[12px] text-danger-fg mb-2">{err}</div>}
      <div className="tibi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }}
                    onChange={toggleAll}
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  />
                </th>
                <th style={{ width: 56 }}>Photo</th>
                <th>SKU</th>
                <th>Item</th>
                <th>Brand</th>
                <th>Size</th>
                <th>Color</th>
                <th className="text-right">Price</th>
                <th className="text-right">Stock</th>
                <th>Status</th>
                {canAdjust && <th />}
              </tr>
            </thead>
            <tbody>
              {filteredVariants.length === 0 ? (
                <tr><td colSpan={canAdjust ? 11 : 10} className="text-center text-ink-hint py-12">
                  {search ? `No item matches “${search}”.` : 'No items. Click Add item.'}
                </td></tr>
              ) : filteredVariants.map((v) => {
                const soldOut = v.stock_qty <= 0;
                return (
                  <tr key={v.id}>
                    <td><input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} /></td>
                    <td>
                      {v.photo_url ? (
                        <ZoomableImage src={v.photo_url} className="w-10 h-10 rounded-input object-cover border-hairline border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-input bg-surface" />
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-ink-secondary">{v.sku}</td>
                    <td>{v.product.name}</td>
                    <td><span className="inline-flex items-center gap-2">{v.brand.name}<BrandTypeBadge type={v.brand.type} /></span></td>
                    <td className="text-ink-secondary">{v.size ?? '—'}</td>
                    <td className="text-ink-secondary">{v.color ?? '—'}</td>
                    <td className="text-right">{formatXOF(v.retail_price_xof)}</td>
                    <td className="text-right">{v.stock_qty}</td>
                    <td>
                      {v.status === 'discontinued' ? <Badge tone="neutral">Discontinued</Badge> :
                        soldOut ? <Badge tone="danger">Sold out</Badge> :
                        <Badge tone="success">In stock</Badge>}
                    </td>
                    {canAdjust && (
                      <td>
                        <button
                          type="button"
                          onClick={() => setAdjustFor(v)}
                          className="text-[11px] text-ink-secondary hover:text-ink"
                        >
                          Adjust
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adjustFor && (
        <AdjustModal
          variant={adjustFor}
          onClose={() => setAdjustFor(null)}
          onSaved={() => { setAdjustFor(null); router.refresh(); }}
        />
      )}
    </>
  );
}

const reasons: Array<{ id: 'damaged' | 'lost' | 'theft' | 'correction' | 'other'; label: string }> = [
  { id: 'damaged', label: 'Damaged' },
  { id: 'lost', label: 'Lost' },
  { id: 'theft', label: 'Theft' },
  { id: 'correction', label: 'Correction' },
  { id: 'other', label: 'Other' },
];

function AdjustModal({ variant, onClose, onSaved }: { variant: VariantRow; onClose: () => void; onSaved: () => void }) {
  const [newQty, setNewQty] = useState(String(variant.stock_qty));
  const [reason, setReason] = useState<(typeof reasons)[number]['id']>('damaged');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const delta = (parseInt(newQty, 10) || 0) - variant.stock_qty;

  function save() {
    setErr(null);
    const qty = parseInt(newQty, 10);
    if (Number.isNaN(qty) || qty < 0) { setErr('Enter a valid quantity.'); return; }
    start(async () => {
      const res = await adjustVariantStock({
        variant_id: variant.id,
        new_qty: qty,
        reason,
        notes: notes || null,
      });
      if (!res.ok) { setErr(res.error); return; }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-bg rounded-card w-full max-w-[480px] p-6 flex flex-col gap-4">
        <div>
          <div className="tibi-label mb-1">Adjust stock</div>
          <div className="text-[14px] font-medium">{variant.product.name}</div>
          <div className="text-[11px] text-ink-hint font-mono">{variant.sku}</div>
        </div>

        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <div className="tibi-label mb-1.5">Current</div>
            <div className="tibi-input flex items-center justify-center">{variant.stock_qty}</div>
          </div>
          <Input label="New quantity" type="number" min="0" value={newQty} onChange={(e) => setNewQty(e.target.value)} required />
          <div>
            <div className="tibi-label mb-1.5">Change</div>
            <div className={`tibi-input flex items-center justify-center ${delta > 0 ? 'text-success-fg' : delta < 0 ? 'text-danger-fg' : 'text-ink-secondary'}`}>
              {delta > 0 ? `+${delta}` : delta}
            </div>
          </div>
        </div>

        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
          {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>

        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context for audit trail…" />

        {err && <Badge tone="danger" className="self-start">{err}</Badge>}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={isPending || delta === 0}>
            {isPending ? 'Saving…' : 'Save adjustment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
