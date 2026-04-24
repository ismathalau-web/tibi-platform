'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { getResend, resendConfig } from '@/lib/resend';

export async function closeDay(): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireUser();
  const supabase = createAdminClient();
  // End of "today" — captures everything from the past that wasn't closed
  // (yesterday's forgotten sales + the day before, etc.)
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, total_xof, payment_method, seller_name, created_at')
    .lte('created_at', endOfToday.toISOString())
    .eq('is_locked', false)
    .is('voided_at', null);

  const safe = (sales ?? []) as Array<{ id: string; invoice_no: number; total_xof: number; payment_method: string; seller_name: string; created_at: string }>;
  if (safe.length === 0) return { ok: false, error: 'Nothing to close — all sales are already closed.' };

  const { error: lockErr } = await supabase
    .from('sales')
    .update({ is_locked: true })
    .in('id', safe.map((s) => s.id));
  if (lockErr) return { ok: false, error: lockErr.message };

  // Email summary (best-effort) — group by date if multiple days are being closed at once
  if (process.env.RESEND_API_KEY) {
    try {
      const gmv = safe.reduce((s, x) => s + x.total_xof, 0);
      const byDate = new Map<string, typeof safe>();
      for (const s of safe) {
        const d = new Date(s.created_at).toISOString().slice(0, 10);
        const arr = byDate.get(d) ?? [];
        arr.push(s);
        byDate.set(d, arr);
      }
      const sections = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, items]) => {
          const dayGmv = items.reduce((s, x) => s + x.total_xof, 0);
          const lines = items.map((s) => `  #${s.invoice_no} · ${s.seller_name} · ${s.payment_method} · ${Math.round(s.total_xof)} XOF`).join('\n');
          return `${date} — ${items.length} sale${items.length > 1 ? 's' : ''} · ${Math.round(dayGmv)} XOF\n${lines}`;
        }).join('\n\n');
      const dayCount = byDate.size;
      const subject = dayCount === 1
        ? `Tibi Concept Store Cotonou — Daily close ${new Date().toLocaleDateString('en-GB')}`
        : `Tibi Concept Store Cotonou — Close (${dayCount} days, ${safe.length} sales)`;
      await getResend().emails.send({
        from: resendConfig.from,
        to: [resendConfig.adminNotify],
        subject,
        text: `Tibi — close summary\n\nTotal: ${safe.length} sales · ${Math.round(gmv)} XOF across ${dayCount} day${dayCount > 1 ? 's' : ''}\n\n${sections}`,
      });
    } catch (err) {
      console.warn('Daily-close email failed', err);
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/close');
  revalidatePath('/pos');
  return { ok: true, count: safe.length };
}

/**
 * Save cash drawer reconciliation for today.
 * Captures opening + expected + counted → computes variance.
 * Works independently from closeDay — she can reconcile cash without locking sales.
 */
export async function saveCashReconciliation(params: {
  opening_xof: number;
  counted_xof: number;
  notes: string | null;
}): Promise<{ ok: boolean; error?: string; expected_xof?: number; variance_xof?: number }> {
  const user = await requireUser();
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  // Cash sales today
  const { data: cashSales } = await supabase
    .from('sales')
    .select('total_xof')
    .eq('payment_method', 'cash')
    .is('voided_at', null)
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString());
  const cashSalesTotal = ((cashSales ?? []) as Array<{ total_xof: number }>).reduce((s, x) => s + x.total_xof, 0);

  // Cash refunds today
  const { data: cashRefunds } = await supabase
    .from('returns')
    .select('refund_xof')
    .eq('refund_method', 'cash')
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString());
  const cashRefundsTotal = ((cashRefunds ?? []) as Array<{ refund_xof: number }>).reduce((s, r) => s + r.refund_xof, 0);

  // Cash expenses today
  const { data: cashExpenses } = await supabase
    .from('expenses')
    .select('amount_xof')
    .eq('payment_method', 'cash')
    .eq('incurred_on', today);
  const cashExpensesTotal = ((cashExpenses ?? []) as Array<{ amount_xof: number }>).reduce((s, e) => s + e.amount_xof, 0);

  const expected = params.opening_xof + cashSalesTotal - cashRefundsTotal - cashExpensesTotal;
  const variance = params.counted_xof - expected;

  const { error } = await supabase.from('cash_closes').insert({
    close_date: today,
    opening_xof: params.opening_xof,
    cash_sales_xof: cashSalesTotal,
    cash_refunds_xof: cashRefundsTotal,
    cash_expenses_xof: cashExpensesTotal,
    expected_xof: expected,
    counted_xof: params.counted_xof,
    variance_xof: variance,
    notes: params.notes,
    closed_by: user.displayName ?? user.email ?? 'staff',
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/reports/close');
  return { ok: true, expected_xof: expected, variance_xof: variance };
}

/**
 * Reopen today: unlocks all of today's locked sales so close can be re-run.
 * Both admin and seller can reopen — matches real-shop flexibility.
 */
export async function reopenDay(): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireUser();
  const supabase = createAdminClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { data: sales, error } = await supabase
    .from('sales')
    .update({ is_locked: false })
    .gte('created_at', since.toISOString())
    .eq('is_locked', true)
    .select('id');
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/close');
  revalidatePath('/pos');
  return { ok: true, count: (sales ?? []).length };
}
