import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from './settings-client';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const [ratesRes, cyclesRes, employeesRes, settingsRes] = await Promise.all([
    supabase.from('exchange_rates').select('*').order('currency_code'),
    supabase.from('cycles').select('*').order('start_date', { ascending: false }),
    supabase.from('employees').select('*').order('name'),
    supabase.from('settings').select('*'),
  ]);

  const settings: Record<string, unknown> = {};
  for (const s of (settingsRes.data ?? []) as Array<{ key: string; value: unknown }>) {
    settings[s.key] = s.value;
  }

  return (
    <SettingsClient
      rates={(ratesRes.data ?? []) as Array<{ id: string; currency_code: string; rate_to_xof: number; updated_at: string }>}
      cycles={(cyclesRes.data ?? []) as Array<{ id: string; name: string; start_date: string; end_date: string; is_active: boolean }>}
      employees={(employeesRes.data ?? []) as Array<{ id: string; name: string; is_active: boolean }>}
      settings={settings}
    />
  );
}
