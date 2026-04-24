'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatXOF } from '@/lib/format';
import { createSale, sendInvoiceEmail } from './actions';
import { BarcodeScanner } from './barcode-scanner';
import { CustomerPicker } from './customer-picker';
import type { PosItem } from '@/lib/data/pos';
import type { Employee } from '@/lib/supabase/types';

interface PreorderSeed {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  deposit_xof: number;
  items: Array<{ variant_id: string; qty: number; unit_price_xof: number }>;
}

interface Props {
  catalog: PosItem[];
  employees: Employee[];
  preorderSeed?: PreorderSeed | null;
  todayClosed?: boolean;
}

interface CartLine {
  item: PosItem;
  qty: number;
}

const categories = ['All', 'Fashion', 'Beauty', 'Home', 'Accessories', 'Editions', 'Stationary', 'Books', 'Other'];
const paymentMethods = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'other', label: 'Other' },
] as const;

type PaymentMethod = (typeof paymentMethods)[number]['id'];

export function PosScreen({ catalog, employees, preorderSeed, todayClosed }: Props) {
  const initialCart: CartLine[] = preorderSeed
    ? preorderSeed.items
        .map((it) => {
          const item = catalog.find((c) => c.variant_id === it.variant_id);
          return item ? { item: { ...item, retail_price_xof: it.unit_price_xof }, qty: it.qty } : null;
        })
        .filter(Boolean) as CartLine[]
    : [];

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>(initialCart);
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentOther, setPaymentOther] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [sellerName, setSellerName] = useState(employees[0]?.name ?? '');
  const [customerName, setCustomerName] = useState(preorderSeed?.customer_name ?? '');
  const [customerEmail, setCustomerEmail] = useState(preorderSeed?.customer_email ?? '');
  const [customerPhone, setCustomerPhone] = useState(preorderSeed?.customer_phone ?? '');
  const [notes, setNotes] = useState(
    preorderSeed
      ? `Pre-order collected · deposit ${preorderSeed.deposit_xof.toLocaleString('en').replace(/,/g, ' ')} XOF already paid`
      : '',
  );
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [postSale, setPostSale] = useState<{ saleId: string; invoiceNo: number; total: number } | null>(null);
  const [sendStatus, setSendStatus] = useState<null | 'sending' | 'sent' | 'error'>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [isPending, start] = useTransition();

  const cartScrollRef = useRef<HTMLDivElement>(null);
  const [flashVariantId, setFlashVariantId] = useState<string | null>(null);
  const [cartPulse, setCartPulse] = useState(false);

  // Auto-scroll cart to bottom + pulse on new item
  useEffect(() => {
    if (cart.length === 0) return;
    const el = cartScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const lastVariantId = cart[cart.length - 1]?.item.variant_id;
    if (lastVariantId) {
      setFlashVariantId(lastVariantId);
      setCartPulse(true);
      const t1 = setTimeout(() => setFlashVariantId(null), 800);
      const t2 = setTimeout(() => setCartPulse(false), 800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [cart.length, cart]);

  const brands = useMemo(() => {
    const byBrand = new Map<string, number>();
    for (const it of catalog) byBrand.set(it.brand_name, (byBrand.get(it.brand_name) ?? 0) + 1);
    return Array.from(byBrand.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((it) => {
      if (q) {
        const hay = `${it.product_name} ${it.brand_name} ${it.sku} ${it.size ?? ''} ${it.color ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category !== 'All') {
        if ((it.category ?? '').toLowerCase() !== category.toLowerCase()) return false;
      }
      if (brandFilter && it.brand_name !== brandFilter) return false;
      return true;
    });
  }, [catalog, query, category, brandFilter]);

  const subtotal = cart.reduce((s, l) => s + l.qty * l.item.retail_price_xof, 0);
  const discountNum = Math.max(0, Math.min(subtotal, Math.round((parseFloat(discount || '0') || 0) / 100 * subtotal)));
  const total = Math.max(0, subtotal - discountNum);

  function addItem(it: PosItem) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.item.variant_id === it.variant_id);
      if (idx >= 0) {
        const existing = prev[idx];
        if (existing.qty >= it.stock_qty) return prev;
        const next = [...prev];
        next[idx] = { ...existing, qty: existing.qty + 1 };
        return next;
      }
      return [...prev, { item: it, qty: 1 }];
    });
  }

  function changeQty(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.item.variant_id === variantId
            ? { ...l, qty: Math.max(0, Math.min(l.item.stock_qty, l.qty + delta)) }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  function onBarcodeScanned(sku: string) {
    const match = catalog.find((c) => c.sku === sku);
    if (match) {
      addItem(match);
      setScanning(false);
    } else {
      setErr(`SKU ${sku} not found or out of stock`);
      setTimeout(() => setErr(null), 3000);
    }
  }

  async function complete() {
    setErr(null);
    if (cart.length === 0) return setErr('Cart is empty.');
    if (!sellerName) return setErr('Select a seller.');
    if (discountNum > 0 && !discountReason.trim()) return setErr('Reason required for discount.');
    if (paymentMethod === 'other' && !paymentOther.trim()) return setErr('Please specify the payment method.');
    if (paymentMethod === 'cash') {
      const cr = parseInt(cashReceived || '0', 10) || 0;
      if (cr < total) return setErr(`Cash received (${formatXOF(cr)}) is less than total (${formatXOF(total)}).`);
    }

    start(async () => {
      const res = await createSale({
        items: cart.map((l) => ({
          variant_id: l.item.variant_id,
          qty: l.qty,
          unit_price_xof: l.item.retail_price_xof,
        })),
        discount_xof: discountNum,
        discount_reason: discountNum > 0 ? discountReason : null,
        payment_method: paymentMethod,
        payment_other: paymentMethod === 'other' ? paymentOther : null,
        cash_received_xof: paymentMethod === 'cash' ? (parseInt(cashReceived || '0', 10) || total) : null,
        seller_name: sellerName,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        notes: notes || null,
      });
      if (!res.ok) {
        setErr(res.error ?? 'Could not complete the sale.');
        return;
      }
      setPostSale({ saleId: res.saleId!, invoiceNo: res.invoiceNo!, total: res.total_xof! });
      setCart([]);
      setDiscount('');
      setDiscountReason('');
      setPaymentOther('');
      setCashReceived('');
      setNotes('');
      // Prefill the send-to-customer email field with the customer's email if provided
      if (customerEmail) setEmailRecipient(customerEmail);
      // Auto-send admin copy attempt (no-op if Resend not configured).
      // If customer email was captured at checkout, also send to them.
      setSendStatus('sending');
      const sendRes = await sendInvoiceEmail({
        saleId: res.saleId!,
        to: customerEmail?.trim() || undefined,
      });
      setSendStatus(sendRes.ok ? 'sent' : 'error');
    });
  }

  async function sendToCustomer() {
    if (!postSale || !emailRecipient.trim()) return;
    setSendStatus('sending');
    const res = await sendInvoiceEmail({ saleId: postSale.saleId, to: emailRecipient.trim() });
    setSendStatus(res.ok ? 'sent' : 'error');
  }

  function whatsappLink() {
    if (!postSale) return '#';
    const phone = (customerPhone || emailRecipient).replace(/[^0-9]/g, '');
    const msg = `Tibi — Invoice #${postSale.invoiceNo} · ${formatXOF(postSale.total)}. Thank you.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  function reset() {
    setPostSale(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setEmailRecipient('');
    setSendStatus(null);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-49px)]">
      {todayClosed && (
        <div className="bg-warning-bg border-b border-hairline border-warning-fg/30 px-5 py-2.5 text-[12px] text-warning-fg flex items-center gap-2">
          <span className="font-medium">Day closed</span>
          <span className="text-warning-fg/80">
            — new sales will be included in tomorrow&rsquo;s close.
          </span>
        </div>
      )}
      <div className="grid lg:grid-cols-[3fr_2fr] flex-1 min-h-0">
      <section className="flex flex-col border-b lg:border-b-0 lg:border-r border-hairline border-border min-h-0">
        <div className="px-4 py-3 border-b border-hairline border-border flex gap-2">
          <div className="flex-1">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, brand, SKU…"
              className="tibi-input w-full"
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => setScanning((s) => !s)}>
            {scanning ? 'Stop scan' : 'Scan'}
          </Button>
        </div>

        {scanning && (
          <div className="p-3 border-b border-hairline border-border">
            <BarcodeScanner onScan={onBarcodeScanned} />
          </div>
        )}

        <div className="px-4 py-3 border-b border-hairline border-border overflow-x-auto">
          <div className="flex gap-2 text-[12px]">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setBrandFilter(null); }}
                className={`px-3 h-7 rounded-pill border-hairline border whitespace-nowrap ${category === c ? 'bg-ink text-white border-ink' : 'text-ink-secondary hover:bg-hover border-border'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {!query && category === 'All' && !brandFilter && (
          <div className="px-4 py-3 border-b border-hairline border-border overflow-x-auto">
            <div className="flex flex-wrap gap-2 text-[12px]">
              {brands.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setBrandFilter(name)}
                  className="px-3 h-7 rounded-pill border-hairline border border-border text-ink-secondary hover:bg-hover whitespace-nowrap"
                >
                  {name} <span className="text-ink-hint">· {count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {brandFilter && (
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <span className="tibi-label">{brandFilter}</span>
              <button className="text-[11px] text-ink-secondary hover:text-ink" onClick={() => setBrandFilter(null)}>Clear</button>
            </div>
          )}
          <ul className="divide-y divide-divider">
            {visible.length === 0 ? (
              <li className="px-5 py-10 text-center text-ink-hint text-[13px]">No items.</li>
            ) : (
              visible.map((it) => {
                const soldOut = it.stock_qty <= 0;
                return (
                  <li
                    key={it.variant_id}
                    className={`group px-5 py-4 flex items-center gap-4 border-l-2 border-transparent transition-all ${soldOut ? 'opacity-50' : 'hover:bg-hover hover:border-l-ink hover:pl-6'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium truncate">{it.product_name}</div>
                      <div className="text-[11px] text-ink-secondary truncate mt-0.5">
                        {it.brand_name}
                        {it.size ? ` · ${it.size}` : ''}
                        {it.color ? ` · ${it.color}` : ''}
                        <span className="font-mono text-ink-hint"> · {it.sku}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-[110px]">
                      <div className="text-[14px] font-medium tabular-nums tracking-tight">{formatXOF(it.retail_price_xof)}</div>
                      <div className={`text-[10px] mt-0.5 ${soldOut ? 'text-danger-fg font-medium' : 'text-ink-hint'}`}>
                        {soldOut ? 'Sold out' : `${it.stock_qty} in stock`}
                      </div>
                    </div>
                    <button
                      onClick={() => !soldOut && addItem(it)}
                      disabled={soldOut}
                      className="tibi-btn tibi-btn-primary h-10 px-5 min-w-[88px] shrink-0 shadow-sm group-hover:shadow-md transition-shadow"
                    >
                      {soldOut ? '—' : 'Add'}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>

      <section className="flex flex-col min-h-0 bg-surface/60">
        <div className="px-5 py-4 border-b border-hairline border-border flex items-center justify-between shrink-0 bg-bg">
          <span className={`tibi-label transition-colors ${cartPulse ? 'text-accent' : ''}`}>
            Cart {cart.length > 0 && `· ${cart.length} ${cart.length > 1 ? 'items' : 'item'}`}
          </span>
          {cart.length > 0 && (
            <button className="text-[11px] text-ink-secondary hover:text-danger-fg" onClick={() => setCart([])}>Clear</button>
          )}
        </div>
        <div ref={cartScrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="p-10 text-center text-[12px] text-ink-hint">Add items to start a sale.</div>
          ) : (
            <ul className="divide-y divide-divider">
              {cart.map((l) => (
                <li
                  key={l.item.variant_id}
                  className={`px-5 py-4 flex items-center gap-3 transition-colors bg-bg ${flashVariantId === l.item.variant_id ? 'bg-hover' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{l.item.product_name}</div>
                    <div className="text-[11px] text-ink-secondary truncate mt-0.5">
                      {l.item.brand_name}
                      {l.item.size ? ` · ${l.item.size}` : ''}
                      {l.item.color ? ` · ${l.item.color}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(l.item.variant_id, -1)} className="h-8 w-8 rounded-pill border-hairline border border-border hover:bg-hover active:scale-95 transition-transform">−</button>
                    <span className="w-6 text-center text-[14px] font-medium tabular-nums">{l.qty}</span>
                    <button onClick={() => changeQty(l.item.variant_id, +1)} className="h-8 w-8 rounded-pill border-hairline border border-border hover:bg-hover active:scale-95 transition-transform">+</button>
                  </div>
                  <div className="w-24 text-right text-[14px] font-medium tabular-nums tracking-tight shrink-0">
                    {formatXOF(l.qty * l.item.retail_price_xof)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-5 border-t border-hairline border-border flex flex-col gap-4 text-[13px] shrink-0 max-h-[65%] overflow-y-auto bg-bg">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="Discount (%)"
                type="number"
                min="0"
                max="100"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                hint={discountNum > 0 ? `− ${formatXOF(discountNum)}` : undefined}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder={discountNum > 0 ? 'Required' : 'Optional'}
              />
            </div>
          </div>

          <div className="rounded-card border border-hairline border-border bg-surface/70 px-4 py-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-ink-secondary">
              <span>Subtotal</span><span className="tabular-nums">{formatXOF(subtotal)}</span>
            </div>
            {discountNum > 0 && (
              <div className="flex justify-between text-ink-secondary">
                <span>Discount</span><span className="tabular-nums">−{formatXOF(discountNum)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-hairline border-border">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-secondary">Total</span>
              <span className="font-medium text-ink text-[22px] tabular-nums tracking-tight">{formatXOF(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Select label="Payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
            {paymentMethod === 'other' ? (
              <Input label="Specify" value={paymentOther} onChange={(e) => setPaymentOther(e.target.value)} />
            ) : <div />}
          </div>
          {paymentMethod === 'cash' && total > 0 && (() => {
            const cr = parseInt(cashReceived || '0', 10) || 0;
            const change = cr - total;
            const insufficient = cr > 0 && cr < total;
            return (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Cash received"
                  type="number"
                  min="0"
                  step="500"
                  placeholder={String(total)}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
                <div>
                  <div className="tibi-label mb-1.5">Change to return</div>
                  <div className={`tibi-input flex items-center justify-end font-medium tabular-nums ${insufficient ? 'text-danger-fg' : change > 0 ? 'text-ink' : 'text-ink-hint'}`}>
                    {insufficient ? 'Insufficient' : change > 0 ? formatXOF(change) : '—'}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <Select label="Seller" value={sellerName} onChange={(e) => setSellerName(e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </Select>
            <CustomerPicker
              name={customerName}
              email={customerEmail}
              phone={customerPhone}
              onName={setCustomerName}
              onEmail={setCustomerEmail}
              onPhone={setCustomerPhone}
              label="Customer (optional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Customer email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <Input label="Customer phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

          {err && <Badge tone="danger" className="self-start">{err}</Badge>}

          <Button onClick={complete} disabled={isPending || cart.length === 0} fullWidth className="h-14 text-[15px] font-medium shadow-sm hover:shadow-md active:scale-[0.99] transition-all">
            {isPending ? 'Completing…' : `Complete Sale · ${formatXOF(total)}`}
          </Button>
        </div>
      </section>

      {postSale && (
        <PostSaleModal
          saleId={postSale.saleId}
          invoiceNo={postSale.invoiceNo}
          total={postSale.total}
          sendStatus={sendStatus}
          emailRecipient={emailRecipient}
          setEmailRecipient={setEmailRecipient}
          sendToCustomer={sendToCustomer}
          whatsappLink={whatsappLink()}
          onClose={reset}
        />
      )}
      </div>
    </div>
  );
}

function PostSaleModal({
  saleId, invoiceNo, total, sendStatus, emailRecipient, setEmailRecipient, sendToCustomer, whatsappLink, onClose,
}: {
  saleId: string;
  invoiceNo: number;
  total: number;
  sendStatus: null | 'sending' | 'sent' | 'error';
  emailRecipient: string;
  setEmailRecipient: (v: string) => void;
  sendToCustomer: () => void;
  whatsappLink: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-bg rounded-card w-full max-w-[440px] p-6 flex flex-col gap-4">
        <div className="text-center">
          <div className="tibi-label mb-2">Sale complete</div>
          <div className="text-[28px] font-medium">{formatXOF(total)}</div>
          <div className="text-[12px] text-ink-secondary mt-1">Invoice #{invoiceNo}</div>
        </div>

        <div className="border-t border-hairline border-divider pt-4 flex flex-col gap-3">
          <span className="tibi-label">Send to</span>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              className="tibi-input flex-1"
            />
            <Button variant="secondary" onClick={sendToCustomer} disabled={!emailRecipient || sendStatus === 'sending'}>
              {sendStatus === 'sending' ? 'Sending…' : 'Send'}
            </Button>
          </div>
          {sendStatus === 'sent' && <Badge tone="success" className="self-start">Sent</Badge>}
          {sendStatus === 'error' && <Badge tone="warning" className="self-start">Couldn&rsquo;t send</Badge>}
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="tibi-btn tibi-btn-secondary">
            Send on WhatsApp
          </a>
          <a href={`/api/invoice/${saleId}`} target="_blank" rel="noreferrer" className="text-[12px] text-ink-secondary hover:text-ink text-center underline-offset-2 hover:underline">
            Download invoice
          </a>
        </div>

        <Button onClick={onClose} fullWidth>New sale</Button>
      </div>
    </div>
  );
}
