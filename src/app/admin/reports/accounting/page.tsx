import { requireAdmin } from '@/lib/auth';
import { getAccountingReport, listCyclesForAccounting, type Scope } from '@/lib/data/accounting';
import { StatCard } from '@/components/ui/card';
import { formatXOF, formatDate } from '@/lib/format';
import { ReportsNav } from '../reports-nav';

export const metadata = { title: 'Accounting' };
export const dynamic = 'force-dynamic';

interface SearchParams {
  scope?: 'cycle' | 'month';
  cycle?: string;
  year?: string;
  month?: string;
}

export default async function AccountingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const cycles = await listCyclesForAccounting();

  let scope: Scope;
  if (searchParams.scope === 'month') {
    const now = new Date();
    scope = {
      type: 'month',
      year: Number(searchParams.year ?? now.getFullYear()),
      month: Number(searchParams.month ?? now.getMonth() + 1),
    };
  } else {
    scope = { type: 'cycle', cycleId: searchParams.cycle };
  }

  const report = await getAccountingReport(scope);
  const currentScope = scope.type === 'cycle' ? 'cycle' : 'month';

  const now = new Date();
  const monthOptions: Array<{ y: number; m: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1000px]">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Accounting</h1>
          <p className="text-[12px] text-ink-hint mt-1">
            Admin only. {report.scope.label} · {formatDate(report.scope.since)} → {formatDate(report.scope.until)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={`/api/accounting/report?${new URLSearchParams(Object.entries(searchParams as Record<string, string>)).toString()}`}
            target="_blank"
            rel="noreferrer"
            className="tibi-btn tibi-btn-secondary"
          >
            PDF
          </a>
          <a
            href={`/api/accounting/report?format=csv&${new URLSearchParams(Object.entries(searchParams as Record<string, string>)).toString()}`}
            className="tibi-btn tibi-btn-secondary"
          >
            CSV
          </a>
        </div>
      </header>

      <ReportsNav />

      <form method="get" className="tibi-card flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Scope</label>
          <select name="scope" defaultValue={currentScope} className="tibi-input w-36">
            <option value="cycle">Per cycle</option>
            <option value="month">Per month</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Cycle</label>
          <select name="cycle" defaultValue={searchParams.cycle ?? ''} className="tibi-input w-56">
            <option value="">Active cycle</option>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Year</label>
          <select name="year" defaultValue={searchParams.year ?? String(now.getFullYear())} className="tibi-input w-24">
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="tibi-label">Month</label>
          <select name="month" defaultValue={searchParams.month ?? String(now.getMonth() + 1)} className="tibi-input w-28">
            {monthOptions.map(({ m }) => (
              <option key={m} value={m}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, m - 1, 1))}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="tibi-btn tibi-btn-secondary">Apply</button>
      </form>

      <section className="tibi-card">
        <h2 className="tibi-section-title mb-3">Tibi taxable revenue (CA imposable)</h2>
        <div className="flex items-baseline gap-3">
          <span className="tibi-stat">{formatXOF(report.tibi_taxable_revenue_xof)}</span>
          <span className="text-[12px] text-ink-hint">= commissions consignation + ventes wholesale + ventes Tibi Editions</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="tibi-section-title">Consignation</h2>
        <p className="text-[12px] text-ink-hint">Tibi collecte pour le compte des marques — seule la commission constitue le revenu Tibi.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <StatCard label="Collecté pour marques" value={formatXOF(report.consignment.gross_collected_xof)} hint="Pas revenu Tibi" />
          <StatCard label="Commissions Tibi" value={formatXOF(report.consignment.commissions_xof)} hint="Revenu Tibi" />
          <StatCard label="Dû aux marques" value={formatXOF(report.consignment.due_to_brands_xof)} />
          <StatCard label="Payé aux marques" value={formatXOF(report.consignment.paid_to_brands_xof)} hint={`Reste ${formatXOF(report.consignment.balance_due_xof)}`} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="tibi-section-title">Wholesale</h2>
        <p className="text-[12px] text-ink-hint">Produits achetés à l&rsquo;unité par Tibi puis revendus — marge totale pour Tibi.</p>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <StatCard label="Ventes" value={formatXOF(report.wholesale.sales_xof)} hint="Revenu Tibi" />
          <StatCard label="COGS (coût achat)" value={formatXOF(report.wholesale.cogs_xof)} />
          <StatCard label="Marge brute" value={formatXOF(report.wholesale.gross_margin_xof)} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="tibi-section-title">Tibi Editions (own label)</h2>
        <p className="text-[12px] text-ink-hint">Produits Tibi — marge totale pour Tibi.</p>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <StatCard label="Ventes" value={formatXOF(report.own_label.sales_xof)} hint="Revenu Tibi" />
          <StatCard label="COGS (production)" value={formatXOF(report.own_label.cogs_xof)} />
          <StatCard label="Marge brute" value={formatXOF(report.own_label.gross_margin_xof)} />
        </div>
      </section>
    </div>
  );
}
