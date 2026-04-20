'use client';

import { useState, useTransition } from 'react';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { saveProfile, submitOnboarding } from './actions';
import { brandCode, buildSku } from '@/lib/sku';
import { formatXOF } from '@/lib/format';
import { compressImage } from '@/lib/image-compress';

interface BrandSeed {
  name: string;
  country: string | null;
  category: string | null;
  email: string | null;
  instagram: string | null;
  currency: string;
}

interface ItemRow {
  name: string;
  size: string;
  color: string;
  retail_price_xof: string;
  qty: string;
  photo_url: string | null;
  uploading?: boolean;
}

const emptyItem = (): ItemRow => ({ name: '', size: '', color: '', retail_price_xof: '', qty: '1', photo_url: null });

const currencies = ['XOF', 'NGN', 'GHS', 'MAD', 'USD', 'EUR'] as const;

export function OnboardingFlow({ token, brand, cycleName }: { token: string; brand: BrandSeed; cycleName: string }) {
  const [step, setStep] = useState<1 | 2 | 3 | 'done'>(1);
  const [profile, setProfile] = useState({
    name: brand.name,
    country: brand.country ?? '',
    category: brand.category ?? '',
    email: brand.email ?? '',
    instagram: brand.instagram ?? '',
    currency: (brand.currency || 'XOF') as (typeof currencies)[number],
  });
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function nextFrom1() {
    setErr(null);
    if (!profile.name.trim() || !profile.country.trim() || !profile.email.trim()) {
      setErr('Name, country and email are required.');
      return;
    }
    start(async () => {
      const res = await saveProfile({ token, ...profile });
      if (!res.ok) {
        setErr(res.error ?? 'Could not save.');
        return;
      }
      setStep(2);
    });
  }

  function nextFrom2() {
    setErr(null);
    const cleaned = items.filter((r) => r.name.trim());
    if (cleaned.length === 0) {
      setErr('Add at least one item.');
      return;
    }
    for (const r of cleaned) {
      if (!r.retail_price_xof || Number(r.retail_price_xof) <= 0) {
        setErr(`Price missing for "${r.name}".`);
        return;
      }
      if (!r.qty || Number(r.qty) <= 0) {
        setErr(`Quantity missing for "${r.name}".`);
        return;
      }
    }
    setItems(cleaned);
    setStep(3);
  }

  async function uploadPhoto(i: number, file: File) {
    setItems((p) => p.map((x, idx) => idx === i ? { ...x, uploading: true } : x));
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('file', compressed, `photo-${Date.now()}.jpg`);
      const res = await fetch(`/api/onboarding/${token}/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setItems((p) => p.map((x, idx) => idx === i ? { ...x, photo_url: data.url, uploading: false } : x));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
      setItems((p) => p.map((x, idx) => idx === i ? { ...x, uploading: false } : x));
    }
  }

  function submit() {
    setErr(null);
    start(async () => {
      const res = await submitOnboarding({
        token,
        items: items.map((r) => ({
          name: r.name,
          size: r.size || null,
          color: r.color || null,
          retail_price_xof: Number(r.retail_price_xof),
          qty: Number(r.qty),
          photo_url: r.photo_url,
        })),
      });
      if (!res.ok) {
        setErr(res.error ?? 'Submission failed.');
        return;
      }
      setStep('done');
    });
  }

  const totalQty = items.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalValue = items.reduce(
    (s, r) => s + (Number(r.retail_price_xof) || 0) * (Number(r.qty) || 0),
    0,
  );

  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;

  if (step === 'done') {
    return (
      <div className="tibi-card flex flex-col items-center text-center gap-4 py-10">
        <div className="text-[22px] font-medium">Submission received</div>
        <p className="text-[13px] text-ink-body max-w-sm">
          Thank you, {profile.name}. Tibi will confirm received quantities at physical receipt. Your
          commission will be confirmed at that point and you'll get your private dashboard link by email.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Progress value={pct} className="flex-1" />
        <span className="text-[11px] text-ink-secondary">Step {step} of 3</span>
      </div>

      {step === 1 && (
        <section className="tibi-card flex flex-col gap-5">
          <h2 className="tibi-section-title">Brand profile</h2>
          <Input
            label="Brand name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-5">
            <Input
              label="Country"
              value={profile.country}
              onChange={(e) => setProfile({ ...profile, country: e.target.value })}
              required
            />
            <Input
              label="Category"
              value={profile.category}
              onChange={(e) => setProfile({ ...profile, category: e.target.value })}
              placeholder="Fashion, Beauty…"
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <Input
              type="email"
              label="Email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              required
            />
            <Input
              label="Instagram"
              value={profile.instagram}
              onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
              placeholder="@handle"
            />
          </div>
          <Select
            label="Native currency"
            value={profile.currency}
            onChange={(e) => setProfile({ ...profile, currency: e.target.value as (typeof currencies)[number] })}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          {err && <div className="text-[12px] text-danger-fg">{err}</div>}
          <div className="flex justify-end">
            <Button onClick={nextFrom1} disabled={isPending}>{isPending ? 'Saving…' : 'Continue'}</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="tibi-card p-0 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="tibi-section-title">Items for {cycleName}</h2>
              <p className="text-[11px] text-ink-hint mt-1">
                SKUs auto-generated: <span className="font-mono">TIBI-{brandCode(profile.name)}-0001-…</span>
              </p>
            </div>
            <Button variant="secondary" onClick={() => setItems((p) => [...p, emptyItem()])}>+ Row</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="tibi-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Item name</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th className="text-right">Public price</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Preview SKU</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td style={{ width: 80 }}>
                      {r.photo_url ? (
                        <div className="relative w-14 h-14 rounded-input overflow-hidden border-hairline border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-0 right-0 h-4 w-4 bg-ink text-white text-[10px] leading-none"
                            onClick={() => setItems((p) => p.map((x, idx) => idx === i ? { ...x, photo_url: null } : x))}
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <label className="w-14 h-14 rounded-input border-hairline border-dashed border-border flex items-center justify-center text-[10px] text-ink-hint cursor-pointer hover:bg-hover">
                          {r.uploading ? '…' : '+ Photo'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadPhoto(i, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </td>
                    <td>
                      <input className="tibi-input h-8" value={r.name} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                    </td>
                    <td>
                      <input className="tibi-input h-8" value={r.size} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, size: e.target.value } : x))} />
                    </td>
                    <td>
                      <input className="tibi-input h-8" value={r.color} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, color: e.target.value } : x))} />
                    </td>
                    <td>
                      <input type="number" min="0" step="100" className="tibi-input h-8 text-right w-28" value={r.retail_price_xof} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, retail_price_xof: e.target.value } : x))} />
                    </td>
                    <td>
                      <input type="number" min="1" step="1" className="tibi-input h-8 text-right w-16" value={r.qty} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x))} />
                    </td>
                    <td className="text-right font-mono text-[10px] text-ink-hint">
                      {buildSku({ brandName: profile.name, num: i + 1, size: r.size || null, color: r.color || null })}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          className="text-[11px] text-ink-secondary hover:text-ink"
                          onClick={() => setItems((p) => {
                            const dup = { ...p[i], photo_url: null };
                            return [...p.slice(0, i + 1), dup, ...p.slice(i + 1)];
                          })}
                        >
                          Duplicate
                        </button>
                        {items.length > 1 && (
                          <button type="button" className="text-[11px] text-ink-secondary hover:text-danger-fg" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>Remove</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-hairline border-divider flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] text-ink-secondary">
              {totalQty} items · estimated value {formatXOF(totalValue)}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={nextFrom2}>Continue</Button>
            </div>
          </div>
          {err && <div className="px-5 pb-4 text-[12px] text-danger-fg">{err}</div>}
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-5">
          <div className="tibi-card">
            <h2 className="tibi-section-title mb-4">Profile</h2>
            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <Row label="Brand" value={profile.name} />
              <Row label="Country" value={profile.country} />
              <Row label="Category" value={profile.category || '—'} />
              <Row label="Currency" value={profile.currency} />
              <Row label="Email" value={profile.email} />
              <Row label="Instagram" value={profile.instagram || '—'} />
            </dl>
          </div>

          <div className="tibi-card p-0 overflow-hidden">
            <div className="px-5 py-4">
              <h2 className="tibi-section-title">Items ({totalQty})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="tibi-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.size || '—'}</td>
                      <td>{r.color || '—'}</td>
                      <td className="text-right">{formatXOF(Number(r.retail_price_xof) || 0)}</td>
                      <td className="text-right">{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="tibi-card flex flex-col gap-2">
            <div className="flex items-center justify-between text-[13px]">
              <span>Total items</span>
              <span className="font-medium">{totalQty}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span>Estimated retail value</span>
              <span className="font-medium">{formatXOF(totalValue)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span>Commission</span>
              <span className="text-ink-secondary">To be confirmed by Tibi</span>
            </div>
          </div>

          {err && <div className="text-[12px] text-danger-fg">{err}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="tibi-label">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
