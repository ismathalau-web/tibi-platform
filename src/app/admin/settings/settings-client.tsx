'use client';

import { useState, useTransition } from 'react';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { activateCycle, createCycle, createEmployee, setEmployeeActive, updateRate, updateSetting } from './actions';

interface Rate { id: string; currency_code: string; rate_to_xof: number; updated_at: string }
interface Cycle { id: string; name: string; start_date: string; end_date: string; is_active: boolean }
interface Employee { id: string; name: string; is_active: boolean }

const sections = [
  { id: 'rates', label: 'Exchange rates' },
  { id: 'cycles', label: 'Cycles' },
  { id: 'labels', label: 'Labels' },
  { id: 'employees', label: 'Employees' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'account', label: 'Account' },
] as const;

type SectionId = (typeof sections)[number]['id'];

export function SettingsClient({ rates, cycles, employees, settings }: {
  rates: Rate[]; cycles: Cycle[]; employees: Employee[]; settings: Record<string, unknown>;
}) {
  const [section, setSection] = useState<SectionId>('rates');
  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <header><h1 className="tibi-page-title">Settings</h1></header>

      <div className="flex gap-1 border-b border-hairline border-divider overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-[12px] border-b-2 whitespace-nowrap ${section === s.id ? 'border-ink text-ink font-medium' : 'border-transparent text-ink-secondary hover:text-ink'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'rates' && <ExchangeRates rates={rates} />}
      {section === 'cycles' && <Cycles cycles={cycles} initialThreshold={Number(settings['alert_threshold'] ?? 5)} />}
      {section === 'labels' && <Labels settings={settings} />}
      {section === 'employees' && <Employees employees={employees} />}
      {section === 'notifications' && <Notifications />}
      {section === 'account' && <Account />}
    </div>
  );
}

function ExchangeRates({ rates }: { rates: Rate[] }) {
  // Two editable fields per currency, kept in sync.
  //  A = 1 [currency] = X XOF        (stored rate)
  //  B = 1 000 XOF = Y [currency]   (reference amount, easier to read)
  const [local, setLocal] = useState(() => Object.fromEntries(rates.map((r) => [r.currency_code, String(r.rate_to_xof)])));
  const [isPending, start] = useTransition();

  function setFromNative(code: string, v: string) {
    setLocal((p) => ({ ...p, [code]: v }));
  }
  function setFromXof(code: string, per1000: string) {
    // per1000 [currency] for 1000 XOF  →  rate = 1000 / per1000
    const n = parseFloat(per1000);
    if (!n || Number.isNaN(n) || n <= 0) return;
    setLocal((p) => ({ ...p, [code]: String(1000 / n) }));
  }
  function per1000Display(code: string) {
    const r = parseFloat(local[code] ?? '0');
    if (!r || Number.isNaN(r) || r <= 0) return '';
    return (1000 / r).toFixed(2);
  }

  function save(code: string) {
    const val = parseFloat(local[code] ?? '0');
    if (!val || Number.isNaN(val) || val <= 0) return;
    start(async () => { await updateRate(code, val); });
  }

  return (
    <section className="tibi-card p-0 overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="tibi-section-title">Exchange rates</h2>
        <p className="text-[12px] text-ink-hint mt-1">
          Edit either column — the other updates automatically.
        </p>
      </div>
      <table className="tibi-table">
        <thead>
          <tr>
            <th>Currency</th>
            <th>1 &nbsp;[currency] =</th>
            <th>1 000 XOF =</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rates.filter((r) => r.currency_code !== 'XOF').map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.currency_code}</td>
              <td>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.0001" min="0"
                    value={local[r.currency_code] ?? ''}
                    onChange={(e) => setFromNative(r.currency_code, e.target.value)}
                    className="tibi-input h-8 text-right w-28"
                  />
                  <span className="text-[11px] text-ink-secondary">XOF</span>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.01" min="0"
                    value={per1000Display(r.currency_code)}
                    onChange={(e) => setFromXof(r.currency_code, e.target.value)}
                    className="tibi-input h-8 text-right w-28"
                  />
                  <span className="text-[11px] text-ink-secondary">{r.currency_code}</span>
                </div>
              </td>
              <td className="text-ink-secondary">{formatDate(r.updated_at)}</td>
              <td>
                <Button variant="secondary" className="h-7 text-[11px] px-3" disabled={isPending} onClick={() => save(r.currency_code)}>Save</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Cycles({ cycles, initialThreshold }: { cycles: Cycle[]; initialThreshold: number }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [threshold, setThreshold] = useState(String(initialThreshold));
  const [isPending, run] = useTransition();

  return (
    <section className="tibi-card p-0 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between">
        <h2 className="tibi-section-title">Cycles</h2>
        <div className="flex items-center gap-2">
          <span className="tibi-label">Alert ≤</span>
          <input
            type="number" min="1" className="tibi-input h-7 w-20 text-right"
            value={threshold} onChange={(e) => setThreshold(e.target.value)}
          />
          <Button variant="secondary" className="h-7 text-[11px] px-3" onClick={() => run(async () => { await updateSetting('alert_threshold', Number(threshold)); })}>Save</Button>
        </div>
      </div>
      <table className="tibi-table">
        <thead><tr><th>Name</th><th>Dates</th><th>Status</th><th /></tr></thead>
        <tbody>
          {cycles.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td className="text-ink-secondary">{formatDate(c.start_date)} → {formatDate(c.end_date)}</td>
              <td>{c.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
              <td>
                {!c.is_active && (
                  <Button variant="secondary" className="h-7 text-[11px] px-3" disabled={isPending} onClick={() => run(async () => { await activateCycle(c.id); })}>Activate</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-4 border-t border-hairline border-divider grid grid-cols-4 gap-3 items-end">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cycle 2 — …" />
        <Input label="Start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="End" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Button
          disabled={isPending || !name || !start || !end}
          onClick={() => run(async () => {
            const ok = await createCycle({ name, start_date: start, end_date: end });
            if (ok.ok) { setName(''); setStart(''); setEnd(''); }
          })}
        >
          Add cycle
        </Button>
      </div>
    </section>
  );
}

function Labels({ settings }: { settings: Record<string, unknown> }) {
  const [size, setSize] = useState(String(settings['label_size'] ?? '40x30'));
  const [barcode, setBarcode] = useState(String(settings['label_barcode'] ?? 'code128'));
  const [content, setContent] = useState(String(settings['label_content'] ?? 'sku_name_price'));
  const [isPending, run] = useTransition();

  return (
    <section className="tibi-card">
      <h2 className="tibi-section-title mb-4">Label printing</h2>
      <div className="grid grid-cols-3 gap-4">
        <Select label="Size (mm)" value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="40x30">40×30</option>
          <option value="50x30">50×30</option>
          <option value="60x40">60×40</option>
        </Select>
        <Select label="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)}>
          <option value="code128">Code 128</option>
          <option value="qr">QR</option>
          <option value="ean13">EAN-13</option>
        </Select>
        <Select label="Content" value={content} onChange={(e) => setContent(e.target.value)}>
          <option value="sku_name_price">SKU + name + price</option>
          <option value="sku_name">SKU + name</option>
          <option value="sku">SKU only</option>
        </Select>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="secondary" disabled={isPending} onClick={() => run(async () => {
          await updateSetting('label_size', size);
          await updateSetting('label_barcode', barcode);
          await updateSetting('label_content', content);
        })}>Save</Button>
        <a href="/api/labels/test" target="_blank" rel="noreferrer" className="text-[12px] text-ink-secondary hover:text-ink underline-offset-2 hover:underline">Print test label (PDF)</a>
      </div>
    </section>
  );
}

function Employees({ employees }: { employees: Employee[] }) {
  const [name, setName] = useState('');
  const [isPending, run] = useTransition();
  return (
    <section className="tibi-card p-0 overflow-hidden">
      <div className="px-5 py-4"><h2 className="tibi-section-title">Employees</h2></div>
      <table className="tibi-table">
        <thead><tr><th>Name</th><th>Status</th><th /></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{e.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
              <td>
                <button className="text-[11px] text-ink-secondary hover:text-ink" onClick={() => run(async () => { await setEmployeeActive(e.id, !e.is_active); })}>
                  {e.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-4 border-t border-hairline border-divider flex items-end gap-3">
        <div className="flex-1"><Input label="New employee name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button disabled={isPending || !name.trim()} onClick={() => run(async () => { await createEmployee(name); setName(''); })}>Add</Button>
      </div>
    </section>
  );
}

function Notifications() {
  return (
    <section className="tibi-card">
      <h2 className="tibi-section-title mb-3">Notifications</h2>
      <ul className="text-[12px] text-ink-body flex flex-col gap-2">
        <li>· Stock alerts — draft prepared in admin, never auto-sent.</li>
        <li>· Brand dashboard updates — realtime via Supabase.</li>
        <li>· Cycle-end PDF — generated on request, sent manually.</li>
        <li>· Payment marked — balance resets; manual trigger only.</li>
        <li>· Onboarding confirmation — automatic (locked on).</li>
      </ul>
    </section>
  );
}

function Account() {
  return (
    <section className="tibi-card">
      <h2 className="tibi-section-title mb-3">Account</h2>
      <dl className="text-[12px] grid grid-cols-2 gap-3">
        <div><dt className="tibi-label">Admin</dt><dd>hello@ismathlauriano.com</dd></div>
        <div><dt className="tibi-label">Resend sender</dt><dd>Tibi &lt;hello@ismathlauriano.com&gt;</dd></div>
        <div><dt className="tibi-label">Version</dt><dd>0.1.0</dd></div>
      </dl>
    </section>
  );
}
