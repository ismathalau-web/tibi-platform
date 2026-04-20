'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { regenerateShareToken } from '../actions';

interface Props {
  brandId: string;
  token: string;
}

export function ShareLinkPanel({ brandId, token }: Props) {
  const [currentToken, setCurrentToken] = useState(token);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState<'onboard' | 'dashboard' | null>(null);
  const [isPending, start] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const onboardingLink = origin ? `${origin}/onboarding/${currentToken}` : '';
  const dashboardLink = origin ? `${origin}/brand/${currentToken}` : '';

  async function copy(kind: 'onboard' | 'dashboard', value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  function regenerate() {
    if (!confirm('Regenerate the share token? The old link stops working immediately.')) return;
    start(async () => {
      const res = await regenerateShareToken(brandId);
      if (res.ok) {
        // The server has revalidated; next render will ship the new token. For now reload.
        window.location.reload();
      }
    });
  }

  return (
    <section className="tibi-card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="tibi-section-title">Share links</h2>
        <button
          type="button"
          onClick={regenerate}
          disabled={isPending}
          className="text-[11px] text-ink-secondary hover:text-ink underline-offset-2 hover:underline"
        >
          {isPending ? 'Regenerating…' : 'Regenerate token'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <LinkRow
          label="Onboarding link"
          hint="Send to the brand to submit their profile and items for the active cycle."
          value={onboardingLink}
          copied={copied === 'onboard'}
          onCopy={() => copy('onboard', onboardingLink)}
        />
        <LinkRow
          label="Dashboard link"
          hint="Private dashboard — sent after onboarding is confirmed on physical receipt."
          value={dashboardLink}
          copied={copied === 'dashboard'}
          onCopy={() => copy('dashboard', dashboardLink)}
        />
      </div>
    </section>
  );
}

function LinkRow({ label, hint, value, copied, onCopy }: { label: string; hint: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="tibi-label">{label}</span>
        <Button type="button" variant="secondary" onClick={onCopy} className="h-7 px-3 text-[11px]">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <input readOnly value={value} className="tibi-input text-[12px] font-mono" />
      <p className="text-[11px] text-ink-hint">{hint}</p>
    </div>
  );
}
