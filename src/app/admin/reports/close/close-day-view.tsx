'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { formatXOF, formatDate, formatNumber } from '@/lib/format';
import type { TodayClose } from '@/lib/data/reports';
import { closeDay, reopenDay, saveCashReconciliation } from './actions';

export function CloseDayView({ data, alreadyClosed = false }: { data: TodayClose; alreadyClosed?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'closed' | 'reopened' | 'error'>(alreadyClosed ? 'closed' : 'idle');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function close() {
    start(async () => {
      setErr(null);
      const res = await closeDay();
      if (res.ok) setStatus('closed');
      else { setErr(res.error ?? 'Close failed'); setStatus('error'); }
    });
  }

  function reopen() {
    if (!confirm('Reopen the day? Today\u2019s sales will be unlocked and can be closed again later.')) return;
    start(async () => {
      setErr(null);
      const res = await reopenDay();
      if (res.ok) setStatus('reopened');
      else { setErr(res.error ?? 'Reopen failed'); setStatus('error'); }
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Daily close</h1>
          <p className="text-[12px] text-ink-hint mt-1">{formatDate(data.date)}</p>
        </div>
        <div className="flex items-center gap-3">
          {status === 'closed' && <Badge tone="success">Day closed</Badge>}
          {status === 'reopened' && <Badge tone="warning">Reopened</Badge>}
          {status === 'closed' ? (
            <Button variant="secondary" onClick={reopen} disabled={isPending}>
              {isPending ? 'Reopening…' : 'Reopen day'}
            </Button>
          ) : (
            <Button onClick={close} disabled={isPending}>
              {isPending ? 'Closing…' : 'Close day'}
            </Button>
          )}
        </div>
      </header>

      {data.pending_previous_days.length > 0 && (
        <section className="rounded-card border-hairline border border-warning-fg/40 bg-warning-bg px-4 py-3 text-[13px] text-warning-fg">
          <div className="font-medium mb-2">
            Previous days never closed — they will be closed too
          </div>
          <ul className="text-[12px] flex flex-col gap-1">
            {data.pending_previous_days.map((d) => (
              <li key={d.date} className="flex items-center justify-between gap-3">
                <span>{formatDate(d.date)}</span>
                <span className="tabular-nums">{d.tx_count} sale{d.tx_count > 1 ? 's' : ''} · {formatXOF(d.gmv_xof)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Transactions today" value={formatNumber(data.tx_count)} />
        <StatCard label="GMV today" value={formatXOF(data.gmv_xof)} />
        <StatCard label="Avg basket" value={formatXOF(data.average_basket_xof)} />
        <StatCard label="Returns today" value={formatXOF(data.returns_total_xof)} hint={`${data.returns_count} item${data.returns_count === 1 ? '' : 's'}`} />
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4"><h2 className="tibi-section-title">By payment method</h2></div>
        <table className="tibi-table">
          <thead><tr><th>Method</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {data.by_payment.length === 0 ? <tr><td colSpan={2} className="text-center text-ink-hint py-4">No sales today.</td></tr> :
              data.by_payment.map((p) => <tr key={p.method}><td>{p.method}</td><td className="text-right">{formatXOF(p.total_xof)}</td></tr>)}
          </tbody>
        </table>
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4"><h2 className="tibi-section-title">By seller</h2></div>
        <table className="tibi-table">
          <thead><tr><th>Seller</th><th className="text-right">Tx</th><th className="text-right">GMV</th></tr></thead>
          <tbody>
            {data.by_seller.length === 0 ? <tr><td colSpan={3} className="text-center text-ink-hint py-4">No sales today.</td></tr> :
              data.by_seller.map((s) => <tr key={s.seller}><td>{s.seller}</td><td className="text-right">{s.tx}</td><td className="text-right">{formatXOF(s.total_xof)}</td></tr>)}
          </tbody>
        </table>
      </section>

      {err && <Badge tone="danger">{err}</Badge>}

      <CashReconciliationPanel data={data} />

      <p className="text-[11px] text-ink-hint">
        Closing the day locks today&rsquo;s sales and emails a PDF summary to {process.env.NEXT_PUBLIC_APP_URL ? 'the admin address.' : 'hello@ismathlauriano.com.'}
      </p>
    </div>
  );
}

function CashReconciliationPanel({ data }: { data: TodayClose }) {
  const [opening, setOpening] = useState(data.last_cash_close?.opening_xof ? String(data.last_cash_close.opening_xof) : '');
  const [counted, setCounted] = useState(data.last_cash_close?.counted_xof ? String(data.last_cash_close.counted_xof) : '');
  const [notes, setNotes] = useState(data.last_cash_close?.notes ?? '');
  const [result, setResult] = useState<{ expected: number; variance: number } | null>(
    data.last_cash_close
      ? { expected: data.last_cash_close.counted_xof - data.last_cash_close.variance_xof, variance: data.last_cash_close.variance_xof }
      : null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const openingNum = parseInt(opening || '0', 10) || 0;
  const countedNum = parseInt(counted || '0', 10) || 0;
  const expectedPreview = openingNum + data.cash_sales_xof - data.cash_refunds_xof - data.cash_expenses_xof;
  const variancePreview = countedNum > 0 ? countedNum - expectedPreview : null;

  function submit() {
    setErr(null);
    if (openingNum < 0) return setErr('Opening cash must be 0 or more.');
    if (countedNum <= 0) return setErr('Counted cash required.');
    start(async () => {
      const res = await saveCashReconciliation({
        opening_xof: openingNum,
        counted_xof: countedNum,
        notes: notes.trim() || null,
      });
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return; }
      setResult({ expected: res.expected_xof ?? 0, variance: res.variance_xof ?? 0 });
    });
  }

  const varianceBig = Math.abs(variancePreview ?? 0) > 5000;

  return (
    <section className="tibi-card flex flex-col gap-4">
      <div>
        <h2 className="tibi-section-title">Cash drawer reconciliation</h2>
        <p className="text-[12px] text-ink-hint mt-1">
          Count the physical cash in the drawer and check that it matches what the system expects.
          Independent from the daily close — you can reconcile anytime.
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="tibi-card !p-4">
          <div className="tibi-label">Cash sales today</div>
          <div className="text-[16px] font-medium tabular-nums">+{formatXOF(data.cash_sales_xof)}</div>
        </div>
        <div className="tibi-card !p-4">
          <div className="tibi-label">Cash refunds</div>
          <div className="text-[16px] font-medium tabular-nums">−{formatXOF(data.cash_refunds_xof)}</div>
        </div>
        <div className="tibi-card !p-4">
          <div className="tibi-label">Cash expenses</div>
          <div className="text-[16px] font-medium tabular-nums">−{formatXOF(data.cash_expenses_xof)}</div>
        </div>
        <div className="tibi-card !p-4">
          <div className="tibi-label">Expected cash (+ opening)</div>
          <div className="text-[16px] font-medium tabular-nums">{formatXOF(expectedPreview)}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Input
          label="Opening cash this morning"
          type="number"
          min="0"
          step="500"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
        />
        <Input
          label="Counted cash (actual)"
          type="number"
          min="0"
          step="500"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
        <div>
          <div className="tibi-label mb-1.5">Variance</div>
          <div className={`tibi-input flex items-center justify-end font-medium tabular-nums ${variancePreview == null ? 'text-ink-hint' : varianceBig ? 'text-danger-fg' : 'text-ink'}`}>
            {variancePreview == null ? '—' : variancePreview >= 0 ? `+${formatXOF(variancePreview)}` : `−${formatXOF(Math.abs(variancePreview))}`}
          </div>
        </div>
      </div>

      <Textarea
        label="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Why the variance? e.g. error on invoice #1234, or cash taken for X"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" onClick={submit} disabled={isPending || countedNum <= 0}>
          {isPending ? 'Saving…' : data.last_cash_close ? 'Update reconciliation' : 'Save reconciliation'}
        </Button>
        {result && (
          <Badge tone={Math.abs(result.variance) > 5000 ? 'danger' : Math.abs(result.variance) > 0 ? 'warning' : 'success'}>
            {result.variance === 0 ? 'Perfect match' : result.variance > 0 ? `+${formatXOF(result.variance)} (over)` : `${formatXOF(result.variance)} (short)`}
          </Badge>
        )}
        {err && <Badge tone="danger">{err}</Badge>}
        {data.last_cash_close && !result && (
          <span className="text-[11px] text-ink-hint">Last saved by {data.last_cash_close.closed_by ?? 'staff'}</span>
        )}
      </div>
    </section>
  );
}
