import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-[18px] font-medium tracking-[0.18em] text-ink">TIBI</div>
          <div className="text-[10px] text-ink-hint mt-1.5 tracking-[0.28em] uppercase">Concept Store</div>
          <div className="text-[10px] text-ink-hint mt-4 tracking-[0.16em] uppercase">Retail Platform</div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
