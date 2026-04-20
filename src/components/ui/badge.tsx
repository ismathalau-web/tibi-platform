import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'dark' | 'accent' | 'success' | 'warning' | 'danger';

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-surface text-ink',
  dark: 'bg-ink text-white',
  accent: 'bg-accent text-white',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className, children, ...rest }: Props) {
  return (
    <span className={cn('tibi-badge', toneStyles[tone], className)} {...rest}>
      {children}
    </span>
  );
}

export function BrandTypeBadge({ type }: { type: 'consignment' | 'wholesale' | 'own_label' }) {
  if (type === 'consignment') return <Badge tone="neutral">Consignment</Badge>;
  if (type === 'wholesale') return <Badge tone="dark">Wholesale</Badge>;
  return <Badge tone="accent">Own Label</Badge>;
}
