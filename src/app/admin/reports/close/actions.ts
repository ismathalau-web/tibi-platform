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
