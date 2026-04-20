'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatXOF, formatDate } from '@/lib/format';
import { recordBrandPayment } from '../actions';

interface Payment {
  id: string;
  amount_xof: number;
  paid_at: string;
  notes: string | null;
  cycle_name: string;
}

interface Props {
  brandId: string;
  balanceDueXof: number;
  currentCycleId: string | null;
  history: Payment[];
}

export function PaymentsPanel({ brandId, balanceDueXof, currentCycleId, history }: Props) {
  const [amount, setAmount] = useState(String(balanceDueXof));
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function save() {
    setErr(null); setSaved(false);
    const n = parseInt(amount, 10);
    if (Number.isNaN(n) || n <= 0) return setErr('Enter an amount.');
    if (!currentCycleId) return setErr('No active cycle.');
    start(async () => {
      const res = await recordBrandPayment({ brandId, cycleId: currentCycleId, amount_xof: n, notes: notes || null });
      if (!res.ok) return setErr(res.error ?? 'Save failed');
      setSaved(true);
      setOpen(false);
      setNotes('');
    });
  }

  return (
    <section className="tibi-card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="tibi-section-title">Payments</h2>
          <p className="text-[12px] text-ink-hint mt-1">
            Balance due this cycle: <strong className="text-ink">{formatXOF(balanceDueXof)}</strong>
          </p>
        </div>
        {!open ? (
          <Button variant="secondary" onClick={() => { setOpen(true); setAmount(String(balanceDueXof)); }} disabled={balanceDueXof <= 0}>
            Record payment
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        )}
      </div>

      {saved && <Badge tone="success" className="self-start">Payment recorded</Badge>}

      {open && (
        <div className="flex flex-col gap-3 pt-2 border-t border-hairline border-divider">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (XOF)"
              type="number" min="0" step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div>
              <div className="tibi-label mb-1.5">Remaining after</div>
              <div className="tibi-input flex items-center justify-center text-ink-secondary">
                {formatXOF(Math.max(0, balanceDueXof - (parseInt(amount, 10) || 0)))}
              </div>
            </div>
          </div>
          <Textarea label="Note (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bank transfer ref, cash, etc." />
          {err && <Badge tone="danger" className="self-start">{err}</Badge>}
          <Button onClick={save} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save payment'}
          </Button>
        </div>
      )}

      <div className="border-t border-hairline border-divider pt-3">
        <div className="tibi-label mb-2">History</div>
        {history.length === 0 ? (
          <p className="text-[12px] text-ink-hint">No payments recorded yet.</p>
        ) : (
          <table className="tibi-table">
            <thead>
              <tr><th>Date</th><th>Cycle</th><th className="text-right">Amount</th><th>Note</th></tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="text-ink-secondary">{formatDate(p.paid_at)}</td>
                  <td className="text-ink-secondary text-[11px]">{p.cycle_name}</td>
                  <td className="text-right font-medium">{formatXOF(p.amount_xof)}</td>
                  <td className="text-ink-secondary text-[12px]">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
