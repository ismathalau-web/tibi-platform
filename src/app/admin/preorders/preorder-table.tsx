'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatXOF, formatDate } from '@/lib/format';
import { setPreorderStatus } from './actions';
import type { PreorderStatus } from '@/lib/supabase/types';

interface Item {
  qty: number;
  unit_price_xof: number;
  name: string;
  brand: string;
  sku: string;
  size: string | null;
  color: string | null;
}

interface Row {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  deposit_xof: number;
  balance_xof: number;
  total_xof: number;
  status: PreorderStatus;
  notes: string | null;
  created_at: string;
  items: Item[];
}

const statusTone: Record<PreorderStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  ready: 'success',
  collected: 'neutral',
  cancelled: 'danger',
};

export function PreorderTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [isPending, start] = useTransition();

  function collect(r: Row) {
    // Mark collected in DB, then redirect to POS with this preorder prefilled
    start(async () => {
      await setPreorderStatus(r.id, 'collected');
      router.push(`/pos?preorder=${r.id}`);
    });
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function change(id: string, next: PreorderStatus) {
    start(async () => { await setPreorderStatus(id, next); });
  }

  return (
    <div className="tibi-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="tibi-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              <th>Customer</th>
              <th>Contact</th>
              <th className="text-right">Items</th>
              <th className="text-right">Total</th>
              <th className="text-right">Balance</th>
              <th>Status</th>
              <th>Since</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-ink-hint py-10">No pre-orders yet.</td></tr>
            ) : rows.flatMap((r) => {
              const isOpen = open.has(r.id);
              const main = (
                <tr key={r.id} className="cursor-pointer" onClick={() => toggle(r.id)}>
                  <td>{isOpen ? '▾' : '▸'}</td>
                  <td>
                    <div>{r.customer_name}</div>
                    {r.notes && <div className="text-[11px] text-ink-hint">{r.notes}</div>}
                  </td>
                  <td className="text-ink-secondary text-[11px]">
                    <div>{r.customer_email ?? '—'}</div>
                    <div>{r.customer_phone ?? '—'}</div>
                  </td>
                  <td className="text-right">{r.items.reduce((s, it) => s + it.qty, 0)}</td>
                  <td className="text-right">{formatXOF(r.total_xof)}</td>
                  <td className="text-right">
                    {formatXOF(r.balance_xof)}
                    {r.deposit_xof > 0 && <div className="text-[10px] text-ink-hint">Deposit: {formatXOF(r.deposit_xof)}</div>}
                  </td>
                  <td><Badge tone={statusTone[r.status]}>{r.status}</Badge></td>
                  <td className="text-ink-secondary">{formatDate(r.created_at)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 flex-wrap items-center">
                      {r.status === 'pending' && (
                        <Button variant="secondary" className="h-7 px-3 text-[11px]" onClick={() => change(r.id, 'ready')} disabled={isPending}>Mark ready</Button>
                      )}
                      {r.status === 'ready' && (
                        <>
                          <Button variant="secondary" className="h-7 px-3 text-[11px]" onClick={() => collect(r)} disabled={isPending}>Collect → POS</Button>
                          {(() => {
                            const firstName = (r.customer_name ?? '').split(/\s+/)[0] || '';
                            const itemsLabel = r.items.length === 1 ? 'votre article' : `vos ${r.items.length} articles`;
                            const msg = `Bonjour ${firstName}, ${itemsLabel} de votre pré-commande chez Tibi Concept Store sont prêts à être récupérés ! Nous vous attendons à la boutique. Bonne journée.`;
                            const subject = 'Tibi Concept Store Cotonou — Votre pré-commande est prête';
                            const emailHref = r.customer_email
                              ? `mailto:${r.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`
                              : null;
                            const waPhone = (r.customer_phone ?? '').replace(/[^0-9]/g, '');
                            const waHref = waPhone
                              ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`
                              : null;
                            if (!emailHref && !waHref) return null;
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-hint">
                                Notify
                                {emailHref && (
                                  <a href={emailHref} title="Email customer" className="ml-1 hover:text-ink">✉</a>
                                )}
                                {waHref && (
                                  <a href={waHref} target="_blank" rel="noreferrer" title="WhatsApp customer" className="hover:text-ink">⌬</a>
                                )}
                              </span>
                            );
                          })()}
                          <button
                            className="text-[10px] text-ink-hint hover:text-ink"
                            onClick={() => change(r.id, 'pending')}
                            disabled={isPending}
                            title="Revert to pending"
                          >
                            ↶
                          </button>
                        </>
                      )}
                      {r.status !== 'cancelled' && r.status !== 'collected' && (
                        <button className="text-[11px] text-ink-hint hover:text-danger-fg" onClick={() => change(r.id, 'cancelled')}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              const detail = isOpen ? (
                <tr key={r.id + '-detail'}>
                  <td colSpan={9} className="bg-surface/50 py-0">
                    <div className="px-12 py-3">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-ink-hint">
                            <th className="text-left py-1">Item</th>
                            <th className="text-left">Brand</th>
                            <th className="text-left">SKU</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Unit</th>
                            <th className="text-right">Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-1">
                                {it.name}
                                {(it.size || it.color) && (
                                  <span className="text-ink-hint"> · {[it.size, it.color].filter(Boolean).join(' · ')}</span>
                                )}
                              </td>
                              <td className="text-ink-secondary">{it.brand}</td>
                              <td className="font-mono text-[11px] text-ink-hint">{it.sku}</td>
                              <td className="text-right">{it.qty}</td>
                              <td className="text-right">{formatXOF(it.unit_price_xof)}</td>
                              <td className="text-right">{formatXOF(it.qty * it.unit_price_xof)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              ) : null;
              return [main, detail].filter(Boolean);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
