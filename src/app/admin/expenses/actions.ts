'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireAdmin } from '@/lib/auth';

const divisions = ['boutique', 'cafe', 'shared'] as const;
const categories = ['supplies', 'transport', 'utilities', 'rent', 'salary', 'maintenance', 'other'] as const;
const methods = ['cash', 'card', 'mobile_money', 'bank_transfer', 'other'] as const;

const createSchema = z.object({
  incurred_on: z.string().min(8), // YYYY-MM-DD
  amount_xof: z.coerce.number().int().positive('Amount must be > 0'),
  division: z.enum(divisions),
  category: z.enum(categories),
  payment_method: z.enum(methods),
  description: z.string().trim().optional().nullable(),
});

export async function createExpense(input: z.infer<typeof createSchema>) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;

  const supabase = createAdminClient();
  const { error } = await supabase.from('expenses').insert({
    incurred_on: v.incurred_on,
    amount_xof: v.amount_xof,
    division: v.division,
    category: v.category,
    payment_method: v.payment_method,
    description: v.description ?? null,
    recorded_by: user.displayName ?? user.email ?? 'staff',
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/admin/expenses');
  revalidatePath('/admin');
  revalidatePath('/admin/reports/accounting');
  return { ok: true as const };
}

export async function deleteExpense(id: string) {
  // Admin-only — prevents sellers from hiding mistakes after admin review
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/admin/expenses');
  revalidatePath('/admin/reports/accounting');
  return { ok: true as const };
}
