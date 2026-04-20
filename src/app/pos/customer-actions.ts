'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

export interface CustomerSuggestion {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Search customers by a free-text fragment (name, email, or phone).
 * Returns up to 5 best matches to power the POS customer autocomplete.
 */
export async function searchCustomers(q: string): Promise<CustomerSuggestion[]> {
  await requireUser();
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = createAdminClient();
  const pattern = `%${query}%`;
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(5);

  return (data ?? []) as CustomerSuggestion[];
}
