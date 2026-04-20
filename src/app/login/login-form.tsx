'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function sendMagic() {
    if (!email) {
      setErr('Enter your email first.');
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setMagicSent(true);
  }

  if (magicSent) {
    return (
      <div className="tibi-card text-center">
        <div className="tibi-label mb-3">Check your inbox</div>
        <p className="text-[13px] text-ink-body">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        type="email"
        label="Email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {err && <div className="text-[12px] text-danger-fg">{err}</div>}
      <Button type="submit" disabled={busy} fullWidth>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
      <button
        type="button"
        className="text-[12px] text-ink-secondary hover:text-ink underline-offset-2 hover:underline mt-1"
        onClick={sendMagic}
        disabled={busy}
      >
        Email me a sign-in link
      </button>
    </form>
  );
}
