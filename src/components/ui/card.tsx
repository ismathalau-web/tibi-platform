import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('tibi-card', className)} {...rest} />;
}

type Accent = 'default' | 'accent' | 'ink';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
  className?: string;
}

export function StatCard({ label, value, hint, accent = 'default', className }: StatCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-3 relative overflow-hidden',
        accent === 'accent' && 'before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-accent',
        accent === 'ink' && 'before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-ink',
        className,
      )}
    >
      <div className="tibi-label">{label}</div>
      <div className="tibi-stat">{value}</div>
      {hint && <div className="text-[12px] text-ink-secondary">{hint}</div>}
    </Card>
  );
}
