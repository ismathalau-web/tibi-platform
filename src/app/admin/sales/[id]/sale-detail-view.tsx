'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { formatXOF } from '@/lib/format';
import type { SaleDetail, SaleAuditEntry } from '@/lib/data/sales';
import type { Employee } from '@/lib/supabase/types';
import { processReturn, editSale, voidSale } from './actions';

interface Props {
  sale: SaleDetail;
  audit: SaleAuditEntry[];
  employees: Employee[];
}

const statusTone: Record<SaleDetail['status'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  completed: 'success',
  partially_returned: 'warning',
  fully_returned: 'neutral',
  voided: 'danger',
};

const statusLabel: Record<SaleDetail['status'], string> = {
  completed: 'Completed',
  partially_returned: 'Partial return',
  fully_returned: 'Fully returned',
  voided: 'Voided',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
}

export function SaleDetailView({ sale, audit, employees }: Props) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<null | 'return' | 'edit' | 'void'>(null);

  const isVoided = sale.status === 'voided';
  const isFullyReturned = sale.status === 'fully_returned';
  const canReturn = !isVoided && !isFullyReturned && sale.items.some((it) => it.qty - it.qty_returned > 0);
  const canEdit = !isVoided;
  const canVoid = !isVoided;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="tibi-page-title">Invoice #{sale.invoice_no}</h1>
            <Badge tone={statusTone[sale.status]}>{statusLabel[sale.status]}</Badge>
            {sale.is_locked && <Badge tone="neutral">Day closed</Badge>}
          </div>
          <p className="text-[12px] text-ink-hint mt-1.5">{formatDateTime(sale.created_at)} · Sold by {sale.seller_name}</p>
          {sale.voided_reason && (
            <p className="text-[12px] text-danger-fg mt-1">Void reason: {sale.voided_reason}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/invoice/${sale.id}`} target="_blank" rel="noreferrer" className="tibi-btn tibi-btn-secondary">
            Invoice PDF
          </a>
          {sale.voided_at && sale.cancellation_note_no && (
            <a
              href={`/api/cancellation-note/${sale.id}`}
              target="_blank"
              rel="noreferrer"
              className="tibi-btn tibi-btn-secondary"
            >
              Cancellation note CAN-{String(sale.cancellation_note_no).padStart(4, '0')}
            </a>
          )}
          {canReturn && (
            <Button onClick={() => setOpenModal('return')}>Return items</Button>
          )}
          {canEdit && (
            <Button variant="secondary" onClick={() => setOpenModal('edit')}>Edit</Button>
          )}
          {canVoid && (
            <button
              onClick={() => setOpenModal('void')}
              className="text-[12px] text-ink-hint hover:text-danger-fg self-center"
            >
              Void sale
            </button>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="tibi-card">
          <h2 className="tibi-label mb-3">Customer</h2>
          <div className="text-[13px] text-ink">{sale.customer_name ?? '—'}</div>
          <div className="text-[12px] text-ink-secondary mt-0.5">
            {sale.customer_email ?? sale.customer_contact ?? '—'}
          </div>
          {sale.customer_phone && (
            <div className="text-[12px] text-ink-secondary">{sale.customer_phone}</div>
          )}
        </div>
        <div className="tibi-card">
          <h2 className="tibi-label mb-3">Payment</h2>
          <div className="text-[13px] text-ink capitalize">
            {sale.payment_method.replace('_', ' ')}
            {sale.payment_other && ` — ${sale.payment_other}`}
          </div>
          <div className="text-[12px] text-ink-secondary mt-0.5">{sale.notes ?? '—'}</div>
        </div>
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="tibi-section-title">Items ({sale.total_items_qty})</h2>
          {sale.total_returned_qty > 0 && (
            <span className="text-[11px] text-ink-secondary">{sale.total_returned_qty} returned</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Brand</th>
                <th>SKU</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Returned</th>
                <th className="text-right">Unit</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.product_name}
                    {(it.size || it.color) && (
                      <span className="text-ink-hint"> · {[it.size, it.color].filter(Boolean).join(' · ')}</span>
                    )}
                  </td>
                  <td className="text-ink-secondary">{it.brand_name}</td>
                  <td className="font-mono text-[11px] text-ink-hint">{it.sku}</td>
                  <td className="text-right">{it.qty}</td>
                  <td className="text-right">{it.qty_returned > 0 ? it.qty_returned : '—'}</td>
                  <td className="text-right">{formatXOF(it.unit_price_xof)}</td>
                  <td className="text-right font-medium">{formatXOF(it.qty * it.unit_price_xof)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-hairline border-divider flex flex-col gap-1 items-end text-[13px]">
          <div className="flex gap-8 w-full max-w-[320px] justify-between">
            <span className="text-ink-secondary">Subtotal</span>
            <span>{formatXOF(sale.subtotal_xof)}</span>
          </div>
          {sale.discount_xof > 0 && (
            <div className="flex gap-8 w-full max-w-[320px] justify-between">
              <span className="text-ink-secondary">
                Discount{sale.discount_reason ? ` · ${sale.discount_reason}` : ''}
              </span>
              <span>−{formatXOF(sale.discount_xof)}</span>
            </div>
          )}
          <div className="flex gap-8 w-full max-w-[320px] justify-between pt-2 border-t border-hairline border-divider mt-2">
            <span className="font-medium">Total</span>
            <span className="font-medium text-[16px] tabular-nums">{formatXOF(sale.total_xof)}</span>
          </div>
        </div>
      </section>

      {/* Audit log */}
      <section className="tibi-card p-0 overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="tibi-section-title">History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr><th>Action</th><th>By</th><th>When</th><th>Details</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><Badge tone="neutral">Created</Badge></td>
                <td>{sale.seller_name}</td>
                <td className="text-ink-secondary">{formatDateTime(sale.created_at)}</td>
                <td className="text-ink-hint">{sale.items.length} item(s) · {formatXOF(sale.total_xof)}</td>
              </tr>
              {audit.map((a) => {
                const d = (a.details as any) ?? {};
                const physicalSeller = d.seller_name as string | undefined;
                const batchId = d.batch_id as string | undefined;
                const creditNoteNo = d.credit_note_no as number | undefined;
                const cancellationNoteNo = d.cancellation_note_no as number | undefined;

                let downloadNode: React.ReactNode = null;
                if (a.action === 'returned' && batchId && creditNoteNo) {
                  downloadNode = (
                    <a
                      href={`/api/credit-note/${batchId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-ink hover:underline"
                    >
                      ↓ CN-{String(creditNoteNo).padStart(4, '0')}
                    </a>
                  );
                } else if (a.action === 'voided' && cancellationNoteNo) {
                  downloadNode = (
                    <a
                      href={`/api/cancellation-note/${sale.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-ink hover:underline"
                    >
                      ↓ CAN-{String(cancellationNoteNo).padStart(4, '0')}
                    </a>
                  );
                }

                return (
                  <tr key={a.id}>
                    <td><Badge tone={a.action === 'voided' ? 'danger' : a.action === 'returned' ? 'warning' : 'neutral'}>{a.action}</Badge></td>
                    <td>
                      {physicalSeller ?? a.actor}
                      {physicalSeller && physicalSeller !== a.actor && (
                        <div className="text-[10px] text-ink-hint mt-0.5">via {a.actor}</div>
                      )}
                    </td>
                    <td className="text-ink-secondary">{formatDateTime(a.created_at)}</td>
                    <td className="text-ink-hint text-[11px]">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>{formatAuditDetails(a)}</span>
                        {downloadNode}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      {openModal === 'return' && (
        <ReturnModal
          sale={sale}
          employees={employees}
          onClose={() => { setOpenModal(null); router.refresh(); }}
        />
      )}
      {openModal === 'edit' && (
        <EditModal
          sale={sale}
          onClose={() => { setOpenModal(null); router.refresh(); }}
        />
      )}
      {openModal === 'void' && (
        <VoidModal
          sale={sale}
          onClose={() => { setOpenModal(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function formatAuditDetails(a: SaleAuditEntry): string {
  const d = a.details as any;
  if (!d) return '';
  if (a.action === 'returned') return `${d.total_refund_xof ? formatXOF(d.total_refund_xof) : ''} · ${d.reason ?? ''}`;
  if (a.action === 'voided') return d.reason ?? '';
  if (a.action === 'edited' && d.changed) return Object.keys(d.changed).join(', ');
  return '';
}

// ----------------------------------------------------------------------------
// RETURN MODAL
// ----------------------------------------------------------------------------
function ReturnModal({ sale, employees, onClose }: { sale: SaleDetail; employees: Employee[]; onClose: () => void }) {
  const returnable = sale.items.filter((it) => it.qty - it.qty_returned > 0);
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const it of returnable) m[it.id] = 0;
    return m;
  });
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'mobile_money' | 'store_credit' | 'other'>('cash');
  // Force the user to pick who processed the return — not defaulting to the
  // original seller avoids silent mis-attribution when a different person handles it.
  const [seller, setSeller] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | { batch_id: string; credit_note_no: number; refund: number }>(null);
  const [isPending, start] = useTransition();

  const totalRefund = returnable.reduce((s, it) => s + ((qtys[it.id] ?? 0) * it.unit_price_xof), 0);
  const anySelected = Object.values(qtys).some((q) => q > 0);

  function submit() {
    setErr(null);
    if (!anySelected) return setErr('Select at least one item.');
    if (!reason.trim()) return setErr('Reason required.');
    if (!seller.trim()) return setErr('Please select who is processing this return.');
    const lines = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([sale_item_id, qty]) => ({ sale_item_id, qty }));
    start(async () => {
      const res = await processReturn({
        sale_id: sale.id,
        lines,
        reason: reason.trim(),
        refund_method: refundMethod,
        seller_name: seller,
        notes: notes.trim() || null,
      });
      if (!res.ok) { setErr(res.error ?? 'Return failed'); return; }
      setSuccess({
        batch_id: res.batch_id!,
        credit_note_no: res.credit_note_no!,
        refund: res.refund_xof ?? totalRefund,
      });
    });
  }

  // Success screen
  if (success) {
    return (
      <Modal title="Return processed" onClose={onClose}>
        <div className="flex flex-col gap-4 items-center text-center py-4">
          <div>
            <div className="tibi-label mb-1">Refund</div>
            <div className="text-[24px] font-medium">{formatXOF(success.refund)}</div>
            <div className="text-[12px] text-ink-hint mt-1">
              Credit note CN-{String(success.credit_note_no).padStart(4, '0')}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/credit-note/${success.batch_id}`}
              target="_blank"
              rel="noreferrer"
              className="tibi-btn tibi-btn-primary"
            >
              Download credit note
            </a>
            <button onClick={onClose} className="tibi-btn tibi-btn-secondary">Close</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Return items" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-ink-hint">
              <th className="text-left py-2">Item</th>
              <th className="text-right">Avail.</th>
              <th className="text-right" style={{ width: 80 }}>Return qty</th>
              <th className="text-right">Refund</th>
            </tr>
          </thead>
          <tbody>
            {returnable.map((it) => {
              const remaining = it.qty - it.qty_returned;
              const q = qtys[it.id] ?? 0;
              return (
                <tr key={it.id} className="border-t border-hairline border-divider">
                  <td className="py-2">
                    {it.product_name}
                    <div className="text-ink-hint text-[11px]">{it.brand_name} · {formatXOF(it.unit_price_xof)}</div>
                  </td>
                  <td className="text-right">{remaining}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      step="1"
                      value={q}
                      onChange={(e) => setQtys((prev) => ({ ...prev, [it.id]: Math.max(0, Math.min(remaining, parseInt(e.target.value || '0', 10))) }))}
                      className="tibi-input h-8 text-right"
                      style={{ width: 64 }}
                    />
                  </td>
                  <td className="text-right tabular-nums">{q > 0 ? formatXOF(q * it.unit_price_xof) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-between pt-3 border-t border-hairline border-divider text-[13px] font-medium">
          <span>Total refund</span>
          <span className="tabular-nums">{formatXOF(totalRefund)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Select label="Refund method" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as any)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="store_credit">Store credit</option>
            <option value="other">Other</option>
          </Select>
          <Select label="Processed by" value={seller} onChange={(e) => setSeller(e.target.value)}>
            <option value="">— Select —</option>
            {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </Select>
        </div>

        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong size, defect, changed mind" />
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        {err && <Badge tone="danger" className="self-start">{err}</Badge>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={!anySelected || isPending}>
            {isPending ? 'Processing…' : `Process return · ${formatXOF(totalRefund)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// EDIT MODAL
// ----------------------------------------------------------------------------
function EditModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const [payment, setPayment] = useState<'cash' | 'card' | 'mobile_money' | 'other'>(sale.payment_method as any);
  const [paymentOther, setPaymentOther] = useState(sale.payment_other ?? '');
  const [customerName, setCustomerName] = useState(sale.customer_name ?? '');
  const [customerEmail, setCustomerEmail] = useState(sale.customer_email ?? '');
  const [customerPhone, setCustomerPhone] = useState(sale.customer_phone ?? '');
  const [notes, setNotes] = useState(sale.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function submit() {
    setErr(null);
    start(async () => {
      const res = await editSale({
        sale_id: sale.id,
        payment_method: payment,
        payment_other: payment === 'other' ? paymentOther.trim() || null : null,
        customer_name: customerName.trim() || null,
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        notes: notes.trim() || null,
      });
      if (!res.ok) { setErr(res.error ?? 'Edit failed'); return; }
      onClose();
    });
  }

  return (
    <Modal title="Edit sale" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Payment method" value={payment} onChange={(e) => setPayment(e.target.value as any)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="other">Other</option>
          </Select>
          {payment === 'other' ? (
            <Input label="Specify" value={paymentOther} onChange={(e) => setPaymentOther(e.target.value)} />
          ) : <div />}
        </div>
        <Input label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Customer email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          <Input label="Customer phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {err && <Badge tone="danger" className="self-start">{err}</Badge>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// VOID MODAL
// ----------------------------------------------------------------------------
function VoidModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | { cancellation_note_no: number }>(null);
  const [isPending, start] = useTransition();

  function submit() {
    setErr(null);
    if (reason.trim().length < 3) return setErr('Please explain why this sale is voided.');
    start(async () => {
      const res = await voidSale({ sale_id: sale.id, reason: reason.trim() });
      if (!res.ok) { setErr(res.error ?? 'Void failed'); return; }
      setSuccess({ cancellation_note_no: res.cancellation_note_no! });
    });
  }

  if (success) {
    return (
      <Modal title="Sale voided" onClose={onClose}>
        <div className="flex flex-col gap-4 items-center text-center py-4">
          <div>
            <div className="tibi-label mb-1">Invoice #{sale.invoice_no}</div>
            <div className="text-[18px] font-medium">Cancelled</div>
            <div className="text-[12px] text-ink-hint mt-1">
              Cancellation note CAN-{String(success.cancellation_note_no).padStart(4, '0')}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/cancellation-note/${sale.id}`}
              target="_blank"
              rel="noreferrer"
              className="tibi-btn tibi-btn-primary"
            >
              Download cancellation note
            </a>
            <button onClick={onClose} className="tibi-btn tibi-btn-secondary">Close</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Void sale" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-ink-body">
          Voiding will cancel invoice <strong>#{sale.invoice_no}</strong> entirely. Stock will be restocked, commissions reversed. This is logged in the audit trail and cannot be silently undone.
        </p>
        <Input
          label="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. duplicate sale, training, wrong SKU scanned"
        />
        {err && <Badge tone="danger" className="self-start">{err}</Badge>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? 'Voiding…' : 'Confirm void'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// GENERIC MODAL
// ----------------------------------------------------------------------------
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-bg rounded-card w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="tibi-section-title">{title}</h2>
          <button onClick={onClose} className="text-ink-hint hover:text-ink text-[18px] leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
