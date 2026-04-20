import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Service-role client — bypasses RLS. Use only in server contexts that have
 * already authorised the caller (admin actions, signed brand-token RPC wrappers).
 */
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
