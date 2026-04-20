import { cn } from '@/lib/cn';

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1 w-full rounded-full bg-surface overflow-hidden', className)}>
      <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}
