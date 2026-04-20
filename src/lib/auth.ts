import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { UserRole, UserProfile } from './supabase/types';

export interface CurrentUser {
  userId: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  employeeId: string | null;
}

/**
 * "Demo mode" — when no real Supabase project is configured, auth is bypassed
 * so the design and route shells can be browsed locally. Disabled automatically
 * once real env vars are set.
 */
function demoModeActive(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url === '' || url.includes('placeholder.supabase.co');
}

const DEMO_USER: CurrentUser = {
  userId: 'demo-admin',
  email: 'demo@tibi.local',
  role: 'admin',
  displayName: 'Ismath',
  employeeId: null,
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (demoModeActive()) return DEMO_USER;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, display_name, employee_id')
    .eq('user_id', user.id)
    .maybeSingle<Pick<UserProfile, 'role' | 'display_name' | 'employee_id'>>();

  // Default new authed users to seller until admin promotes them.
  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile?.role ?? 'seller',
    displayName: profile?.display_name ?? null,
    employeeId: profile?.employee_id ?? null,
  };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/pos');
  return user;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
