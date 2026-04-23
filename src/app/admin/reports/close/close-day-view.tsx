'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatXOF, formatDate, formatNumber } from '@/lib/format';
import type { TodayClose } from '@/lib/data/reports';
import { closeDay, reopenDay } from './actions';

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
      <p className="text-[11px] text-ink-hint">
        Closing the day locks today&rsquo;s sales and emails a PDF summary to {process.env.NEXT_PUBLIC_APP_URL ? 'the admin address.' : 'hello@ismathlauriano.com.'}
      </p>
    </div>
  );
}
