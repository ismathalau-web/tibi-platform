'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatXOF } from '@/lib/format';
import { returnVariantsToBrand } from '../actions';

interface UnsoldVariant {
  id: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  retail_price_xof: number;
  stock_qty: number;
}

interface Props {
  brandId: string;
  brandName: string;
  shareToken: string | null;
  cycleName: string | null;
  unsold: UnsoldVariant[];
}

/**
 * End-of-cycle stock disposition panel.
 * Admin selects unsold variants → click "Return to brand" →
 * variants get returned_at = now() and disappear from POS + brand dashboard.
 * Variants NOT selected stay active → roll over into the next cycle automatically.
 */
export function CycleClosePanel({ brandId, brandName, shareToken, cycleName, unsold }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const allSelected = unsold.length > 0 && selected.size === unsold.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(unsold.map((v) => v.id)));
  }

  function confirmReturn() {
    setErr(null);
    if (selected.size === 0) return setErr('Select at least one item to return.');
    if (!confirm(`Return ${selected.size} variant(s) to ${brandName}? This removes them from the POS and brand dashboard. The items you don't select will roll over into the next cycle.`)) return;
    start(async () => {
      const res = await returnVariantsToBrand({
        brand_id: brandId,
        variant_ids: Array.from(selected),
      });
      if (!res.ok) { setErr(res.error ?? 'Return failed'); return; }
      setDone(res.count ?? 0);
      setSelected(new Set());
      router.refresh();
    });
  }

  const selectedCount = selected.size;
  const selectedQty = unsold.filter((v) => selected.has(v.id)).reduce((s, v) => s + v.stock_qty, 0);
  const selectedValue = unsold.filter((v) => selected.has(v.id)).reduce((s, v) => s + v.stock_qty * v.retail_price_xof, 0);

  return (
    <section className="tibi-card p-0 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="tibi-section-title">Cycle close — unsold stock</h2>
          <p className="text-[12px] text-ink-hint mt-1">
            {cycleName ? `${cycleName} · ` : ''}
            At cycle end, select what you want to physically return to {brandName}.
            Unselected items will roll over into the next cycle automatically.
          </p>
        </div>
        {shareToken && (
          <a
            href={`/api/brand/${shareToken}/report`}
            target="_blank"
            rel="noreferrer"
            className="tibi-btn tibi-btn-secondary"
          >
            Download cycle statement (PDF)
          </a>
        )}
      </div>

      {unsold.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-ink-hint">
          All items for {brandName} are sold out. Nothing to return.
        </div>
      ) : (
        <>
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
                  <th>Item</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th className="text-right">Retail</th>
                  <th className="text-right">Stock left</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {unsold.map((v) => (
                  <tr key={v.id} onClick={() => toggle(v.id)} className="cursor-pointer">
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
                    </td>
                    <td>{v.product_name}</td>
                    <td className="text-ink-secondary text-[12px]">{[v.size, v.color].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="font-mono text-[11px] text-ink-hint">{v.sku}</td>
                    <td className="text-right">{formatXOF(v.retail_price_xof)}</td>
                    <td className="text-right">{v.stock_qty}</td>
                    <td className="text-right">{formatXOF(v.stock_qty * v.retail_price_xof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-hairline border-divider flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] text-ink-secondary">
              {selectedCount > 0 ? (
                <>
                  <strong>{selectedCount}</strong> item{selectedCount > 1 ? 's' : ''} selected · {selectedQty} units · retail value {formatXOF(selectedValue)}
                </>
              ) : (
                <>Select the items you physically give back to the brand</>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {done != null && <Badge tone="success">{done} item{done === 1 ? '' : 's'} returned</Badge>}
              {err && <Badge tone="danger">{err}</Badge>}
              <Button onClick={confirmReturn} disabled={isPending || selected.size === 0}>
                {isPending ? 'Processing…' : `Return ${selected.size || ''} to brand`}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
