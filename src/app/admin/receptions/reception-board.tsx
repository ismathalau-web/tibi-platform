'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomableImage } from '@/components/ui/image-lightbox';
import { formatXOF, formatDate } from '@/lib/format';
import { confirmReception, confirmAllPendingForBrand } from './actions';

interface Item {
  id: string;
  qty_sent: number;
  qty_confirmed: number;
  created_at: string;
  variant: {
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    retail_price_xof: number;
    photo_url: string | null;
    product_name: string;
  };
}

interface Group {
  brand: {
    id: string;
    name: string;
    country: string | null;
    commission_pct: number | null;
    commission_status: 'pending' | 'confirmed';
  };
  items: Item[];
}

export function ReceptionBoard({ groups }: { groups: Group[] }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="tibi-page-title">Receptions</h1>
        <p className="text-[12px] text-ink-hint mt-1">
          Items sent by brands waiting for your physical confirmation. Adjust the quantity if received amount differs, then confirm.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="tibi-card text-center py-12 text-ink-hint text-[13px]">
          Nothing pending. All received items have been confirmed.
        </div>
      ) : (
        groups.map((g) => <BrandGroup key={g.brand.id} group={g} />)
      )}
    </div>
  );
}

function BrandGroup({ group }: { group: Group }) {
  const [localQty, setLocalQty] = useState<Record<string, number>>(
    Object.fromEntries(group.items.map((it) => [it.id, it.qty_sent])),
  );
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [isPending, start] = useTransition();

  function confirmOne(id: string) {
    setErr(null);
    const qty = localQty[id] ?? 0;
    start(async () => {
      const res = await confirmReception(id, qty);
      if (!res.ok) return setErr(res.error ?? 'Confirm failed');
      setConfirmed((s) => new Set([...s, id]));
    });
  }

  function confirmAll() {
    setErr(null);
    start(async () => {
      const res = await confirmAllPendingForBrand(group.brand.id);
      if (!res.ok) return setErr(res.error ?? 'Confirm failed');
      setConfirmed((s) => new Set([...s, ...group.items.map((it) => it.id)]));
    });
  }

  const pendingCount = group.items.filter((it) => !confirmed.has(it.id)).length;

  return (
    <section className="tibi-card p-0 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="tibi-section-title">{group.brand.name}</h2>
            {group.brand.commission_status === 'pending' && (
              <Link href={`/admin/brands/${group.brand.id}`} className="text-[11px]">
                <Badge tone="warning">Commission pending</Badge>
              </Link>
            )}
          </div>
          <div className="text-[12px] text-ink-hint mt-1">
            {group.brand.country ?? '—'}
            {group.brand.commission_pct != null && ` · ${group.brand.commission_pct}%`}
          </div>
        </div>
        {pendingCount > 0 && (
          <Button variant="secondary" disabled={isPending} onClick={confirmAll}>
            Confirm all sent quantities
          </Button>
        )}
      </div>

      <table className="tibi-table">
        <thead>
          <tr>
            <th>Photo</th>
            <th>Item</th>
            <th>SKU</th>
            <th className="text-right">Price</th>
            <th className="text-right">Sent</th>
            <th className="text-right">Received</th>
            <th>Sent on</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {group.items.map((it) => {
            const isConfirmed = confirmed.has(it.id);
            return (
              <tr key={it.id} className={isConfirmed ? 'opacity-40' : ''}>
                <td style={{ width: 80 }}>
                  {it.variant.photo_url ? (
                    <ZoomableImage src={it.variant.photo_url} className="w-14 h-14 rounded-input object-cover border-hairline border-border" />
                  ) : (
                    <div className="w-14 h-14 rounded-input bg-surface text-[9px] text-ink-hint flex items-center justify-center">no photo</div>
                  )}
                </td>
                <td>
                  <div>{it.variant.product_name}</div>
                  <div className="text-[11px] text-ink-secondary">
                    {[it.variant.size, it.variant.color].filter(Boolean).join(' · ') || '—'}
                  </div>
                </td>
                <td className="font-mono text-[11px] text-ink-hint">{it.variant.sku}</td>
                <td className="text-right">{formatXOF(it.variant.retail_price_xof)}</td>
                <td className="text-right">{it.qty_sent}</td>
                <td>
                  <input
                    type="number" min="0" step="1"
                    className="tibi-input h-8 text-right w-20 ml-auto block"
                    value={localQty[it.id] ?? 0}
                    disabled={isConfirmed || isPending}
                    onChange={(e) => setLocalQty((s) => ({ ...s, [it.id]: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                </td>
                <td className="text-ink-secondary text-[11px]">{formatDate(it.created_at)}</td>
                <td>
                  {isConfirmed ? (
                    <Badge tone="success">Confirmed</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      className="h-7 text-[11px] px-3"
                      disabled={isPending}
                      onClick={() => confirmOne(it.id)}
                    >
                      Confirm
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {err && <div className="px-5 pb-4 text-[12px] text-danger-fg">{err}</div>}
    </section>
  );
}
