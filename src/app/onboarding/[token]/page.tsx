import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { OnboardingFlow } from './onboarding-flow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Onboarding' };

export default async function OnboardingPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, country, category, email, instagram, currency, type, share_token')
    .eq('share_token', params.token)
    .eq('type', 'consignment')
    .maybeSingle();

  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, name, start_date, end_date')
    .eq('is_active', true)
    .maybeSingle();

  if (!brand) notFound();

  return (
    <main className="min-h-dvh bg-bg p-5 md:p-10">
      <div className="mx-auto max-w-[820px] flex flex-col gap-8">
        <header>
          <div className="text-[15px] font-medium tracking-[0.18em] text-ink mb-3">TIBI</div>
          <h1 className="tibi-page-title">Brand onboarding</h1>
          <p className="text-[13px] text-ink-body mt-3">
            Welcome, <strong className="text-ink">{brand.name}</strong>. Submit your profile and items
            for <strong className="text-ink">{cycle?.name ?? 'the current cycle'}</strong>.
          </p>
        </header>
        <OnboardingFlow token={params.token} brand={brand} cycleName={cycle?.name ?? ''} />
      </div>
    </main>
  );
}
