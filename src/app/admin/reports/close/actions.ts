'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { getResend, resendConfig } from '@/lib/resend';

export async function closeDay(): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const supabase = createAdminClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const until = new Date();

  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, total_xof, payment_method, seller_name')
    .gte('created_at', since.toISOString())
    .lte('created_at', until.toISOString())
    .eq('is_locked', false);

  const safe = (sales ?? []) as Array<{ id: string; invoice_no: number; total_xof: number; payment_method: string; seller_name: string }>;
  if (safe.length === 0) return { ok: false, error: 'No sales to close today.' };

  const { error: lockErr } = await supabase
    .from('sales')
    .update({ is_locked: true })
    .in('id', safe.map((s) => s.id));
  if (lockErr) return { ok: false, error: lockErr.message };

  // Email summary (best-effort)
  if (process.env.RESEND_API_KEY) {
    try {
      const gmv = safe.reduce((s, x) => s + x.total_xof, 0);
      const lines = safe.map((s) => `#${s.invoice_no} · ${s.seller_name} · ${s.payment_method} · ${Math.round(s.total_xof)} XOF`).join('\n');
      await getResend().emails.send({
        from: resendConfig.from,
        to: [resendConfig.adminNotify],
        subject: `Tibi — daily close ${new Date().toLocaleDateString('en-GB')}`,
        text: `Tibi — daily close\n\nTransactions: ${safe.length}\nGMV: ${Math.round(gmv)} XOF\n\n${lines}`,
      });
    } catch (err) {
      console.warn('Daily-close email failed', err);
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/close');
  revalidatePath('/pos');
  return { ok: true };
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
