import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/ui/card';
import { BrandTypeBadge, Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getDashboardStats, listBrandsWithStats, getActiveCycle } from '@/lib/data/brands';
import { formatXOF, formatDate } from '@/lib/format';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function getYesterdayUnclosed(supabase: ReturnType<typeof createClient>): Promise<{ count: number; gmv: number } | null> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const { data } = await supabase
    .from('sales')
    .select('id, total_xof')
    .gte('created_at', yesterdayStart.toISOString())
    .lt('created_at', todayStart.toISOString())
    .eq('is_locked', false);

  const rows = (data ?? []) as Array<{ id: string; total_xof: number }>;
  if (rows.length === 0) return null;
  return { count: rows.length, gmv: rows.reduce((s, r) => s + r.total_xof, 0) };
}

export default async function AdminDashboard() {
  const supabase = createClient();
  const [user, stats, rows, cycle, pendingMovementsRes, yesterdayUnclosed, settingsRes] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(),
    listBrandsWithStats(),
    getActiveCycle(),
    supabase.from('stock_movements').select('id, qty_sent, qty_confirmed, brands!inner(name)'),
    getYesterdayUnclosed(supabase),
    supabase.from('settings').select('key, value').in('key', ['brand_payout_day']),
  ]);

  // Brand payout day reminder — fire on J-2, J-1, J
  const settingsMap: Record<string, unknown> = {};
  for (const s of (settingsRes.data ?? []) as Array<{ key: string; value: unknown }>) {
    settingsMap[s.key] = s.value;
  }
  const payoutDay = Number(settingsMap['brand_payout_day'] ?? 0);
  const payoutReminder: { daysUntil: number; brandsOwed: number; totalDueXof: number } | null = (() => {
    if (!payoutDay || payoutDay < 1 || payoutDay > 28) return null;
    const today = new Date();
    const currentDay = today.getDate();
    const daysUntil = payoutDay - currentDay;
    // Reminder window: J-2, J-1, J
    if (daysUntil < 0 || daysUntil > 2) return null;
    const brandsOwed = rows.filter((r) => r.brand.type === 'consignment' && r.balance_due_xof > 0);
    if (brandsOwed.length === 0) return null;
    const totalDueXof = brandsOwed.reduce((s, r) => s + r.balance_due_xof, 0);
    return { daysUntil, brandsOwed: brandsOwed.length, totalDueXof };
  })();

  const today = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  let cyclePct = 0;
  let daysLeft = 0;
  let cycleEndingSoon = false;
  if (cycle) {
    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    const now = new Date();
    const total = daysBetween(start, end);
    const elapsed = daysBetween(start, now);
    cyclePct = total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;
    daysLeft = Math.max(0, daysBetween(now, end));
    // Reminder when cycle is about to end (≤ 7 days left) or overdue
    cycleEndingSoon = daysLeft <= 7;
  }

  // Per-brand total stock alert (sum of all variants). Tibi receives 1-2
  // units per variant by design, so per-variant alerting would always fire.
  const alertThreshold = 4;
  const restockAlerts = rows.filter((r) => r.brand.type === 'consignment' && r.stock > 0 && r.stock <= alertThreshold);
  const pendingReceptions = ((pendingMovementsRes.data ?? []) as unknown as Array<{ id: string; qty_sent: number; qty_confirmed: number; brands: { name: string } }>)
    .filter((m) => m.qty_confirmed < m.qty_sent);
  const pendingBrands = Array.from(new Set(pendingReceptions.map((m) => m.brands.name)));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="tibi-page-title">{greeting()}, {user?.displayName ?? 'Ismath'}.</h1>
        <p className="text-[12px] text-ink-hint mt-2">{today}</p>
      </header>

      {/* Alert banners */}
      {(cycleEndingSoon || payoutReminder || yesterdayUnclosed || pendingReceptions.length > 0 || restockAlerts.length > 0) && (
        <div className="flex flex-col gap-2">
          {cycleEndingSoon && cycle && (
            <Link href="/admin/brands" className="block">
              <div className="rounded-card border-hairline border border-warning-fg/40 bg-warning-bg px-4 py-3 text-[13px] text-warning-fg flex items-center justify-between gap-3 hover:opacity-90">
                <span>
                  <strong>
                    {daysLeft === 0 ? 'Cycle ends today' : daysLeft === 1 ? 'Cycle ends tomorrow' : `Cycle ends in ${daysLeft} days`}
                  </strong>
                  {' · '}Review unsold stock + plan end-of-cycle returns with each brand.
                </span>
                <span className="text-[11px]">Brands →</span>
              </div>
            </Link>
          )}
          {payoutReminder && (
            <Link href="/admin/brands" className="block">
              <div className="rounded-card border-hairline border border-accent/40 bg-accent/5 px-4 py-3 text-[13px] text-ink flex items-center justify-between gap-3 hover:opacity-90">
                <span>
                  <strong>
                    {payoutReminder.daysUntil === 0
                      ? 'Today is brand payout day'
                      : payoutReminder.daysUntil === 1
                        ? 'Brand payout day is tomorrow'
                        : `Brand payout day is in ${payoutReminder.daysUntil} days`}
                  </strong>
                  {' · '}
                  {payoutReminder.brandsOwed} brand{payoutReminder.brandsOwed > 1 ? 's' : ''} owed {formatXOF(payoutReminder.totalDueXof)}
                </span>
                <span className="text-[11px]">Review brands →</span>
              </div>
            </Link>
          )}
          {yesterdayUnclosed && (
            <Link href="/admin/reports/close" className="block">
              <div className="rounded-card border-hairline border border-danger-fg/40 bg-danger-bg px-4 py-3 text-[13px] text-danger-fg flex items-center justify-between gap-3 hover:opacity-90">
                <span>
                  <strong>Yesterday not closed</strong> — {yesterdayUnclosed.count} sale{yesterdayUnclosed.count > 1 ? 's' : ''} ({formatXOF(yesterdayUnclosed.gmv)}) pending close
                </span>
                <span className="text-[11px]">Close now →</span>
              </div>
            </Link>
          )}
          {pendingReceptions.length > 0 && (
            <Link href="/admin/receptions" className="block">
              <div className="rounded-card border-hairline border border-warning-fg/40 bg-warning-bg px-4 py-3 text-[13px] text-warning-fg flex items-center justify-between gap-3 hover:opacity-90">
                <span>
                  <strong>{pendingReceptions.length} item{pendingReceptions.length > 1 ? 's' : ''}</strong> waiting for your reception confirmation
                  {pendingBrands.length > 0 && ` — ${pendingBrands.slice(0, 3).join(', ')}${pendingBrands.length > 3 ? '…' : ''}`}
                </span>
                <span className="text-[11px]">Review →</span>
              </div>
            </Link>
          )}
          {restockAlerts.length > 0 && (
            <details className="rounded-card border-hairline border border-border bg-surface px-4 py-3 text-[12px] text-ink-body">
              <summary className="cursor-pointer flex items-center justify-between gap-3 list-none">
                <span>
                  <strong>{restockAlerts.length} brand{restockAlerts.length > 1 ? 's' : ''}</strong> below {alertThreshold} items in stock
                </span>
                <span className="text-[11px] text-ink-secondary">Show draft messages ▾</span>
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
                {restockAlerts.map((r) => {
                  const msg = `Hi ${r.brand.name}, wanted to let you know that your stock at Tibi is getting low — only ${r.stock} items left. If you can prepare a restock for us, that would be great!`;
                  const waPhone = (r.brand.instagram ?? '').replace(/[^0-9]/g, '');
                  const emailHref = `mailto:${r.brand.email ?? ''}?subject=${encodeURIComponent('Tibi Concept Store Cotonou — Restock needed')}&body=${encodeURIComponent(msg)}`;
                  const waHref = waPhone
                    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`
                    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  return (
                    <li key={r.brand.id} className="flex items-center justify-between gap-3 py-1 border-b border-hairline border-divider last:border-0">
                      <div>
                        <div className="text-[13px] font-medium">{r.brand.name}</div>
                        <div className="text-[11px] text-ink-hint">{r.stock} items remaining</div>
                      </div>
                      <div className="flex gap-2">
                        {r.brand.email && (
                          <a href={emailHref} className="text-[11px] text-ink-secondary hover:text-ink">Email</a>
                        )}
                        <a href={waHref} target="_blank" rel="noreferrer" className="text-[11px] text-ink-secondary hover:text-ink">WhatsApp</a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Current cycle */}
      {cycle && (
        <div className="tibi-card flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="tibi-label mb-1">Current cycle</div>
              <div className="text-[14px] font-medium">{cycle.name}</div>
            </div>
            <div className="text-[12px] text-ink-secondary text-right">
              <div>{formatDate(cycle.start_date)} → {formatDate(cycle.end_date)}</div>
              <div className="mt-1 text-ink-hint">{daysLeft} days left</div>
            </div>
          </div>
          <Progress value={cyclePct} />
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Brands" value={stats.active_brands} />
        <StatCard label="Items in Stock" value={stats.items_in_stock} />
        <StatCard label="Cycle GMV" value={formatXOF(stats.cycle_gmv_xof)} hint="Marchandise vendue" accent="ink" />
        <StatCard label="Tibi CA" value={formatXOF(stats.tibi_revenue_xof)} hint="Commissions + wholesale" accent="accent" />
        <StatCard label="Dû aux marques" value={formatXOF(stats.total_due_to_brands_xof)} />
      </section>

      <section className="tibi-card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="tibi-section-title">Brands</h2>
          <Link href="/admin/brands" className="text-[12px] text-ink-secondary hover:text-ink">See all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Country</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Balance due</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.brand.id}>
                  <td>
                    <Link href={`/admin/brands/${r.brand.id}`} className="hover:underline">{r.brand.name}</Link>
                  </td>
                  <td className="text-ink-secondary">{r.brand.country ?? '—'}</td>
                  <td className="text-right">{r.stock}</td>
                  <td className="text-right">{r.sold}</td>
                  <td className="text-right">{r.brand.type === 'consignment' ? formatXOF(r.balance_due_xof) : '—'}</td>
                  <td><BrandTypeBadge type={r.brand.type} /></td>
                  <td>
                    {r.brand.commission_status === 'pending' && r.brand.type === 'consignment' ? (
                      <Badge tone="warning">Commission pending</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-ink-hint py-8">No brands yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
