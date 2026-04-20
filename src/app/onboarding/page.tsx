export const metadata = { title: 'Brand onboarding' };

export default function OnboardingLanding() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-[15px] font-medium tracking-[0.18em] text-ink mb-3">TIBI</div>
        <h1 className="tibi-page-title mb-3">Brand onboarding</h1>
        <p className="text-[13px] text-ink-body">
          Use the personalised invitation link sent to you to begin onboarding. If you didn't receive
          it, contact <a href="mailto:hello@ismathlauriano.com" className="text-ink underline">hello@ismathlauriano.com</a>.
        </p>
      </div>
    </main>
  );
}
