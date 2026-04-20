'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { setCommissionPct } from '../actions';
import type { CommissionStatus } from '@/lib/supabase/types';

interface Props {
  brandId: string;
  initialPct: number | null;
  initialStatus: CommissionStatus;
}

export function CommissionPanel({ brandId, initialPct, initialStatus }: Props) {
  const [pct, setPct] = useState(initialPct != null ? String(initialPct) : '');
  const [status, setStatus] = useState(initialStatus);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, start] = useTransition();

  function save() {
    setErr(null);
    const value = pct.trim() === '' ? null : Number(pct);
    start(async () => {
      const res = await setCommissionPct(brandId, value);
      if (!res.ok) {
        setErr(res.error ?? 'Could not save');
        return;
      }
      setStatus(value != null ? 'confirmed' : 'pending');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <section className="tibi-card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="tibi-section-title">Commission</h2>
          <p className="text-[12px] text-ink-hint mt-1">
            Shown to the brand as just the percentage — no "negotiated" label.
          </p>
        </div>
        {status === 'pending' ? (
          <Badge tone="warning">Pending confirmation</Badge>
        ) : (
          <Badge tone="success">Confirmed</Badge>
        )}
      </div>
      <div className="flex items-end gap-3">
        <div className="w-40">
          <Input
            label="Rate (%)"
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="e.g. 27"
          />
        </div>
        <Button onClick={save} disabled={isPending} variant="secondary">
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-[12px] text-success-fg">Saved.</span>}
        {err && <span className="text-[12px] text-danger-fg">{err}</span>}
      </div>
    </section>
  );
}
