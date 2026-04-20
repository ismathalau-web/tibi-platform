/**
 * XOF (West African CFA franc) formatter — no decimals, space thousands.
 * 12345 -> "12 345 XOF"
 */
export function formatXOF(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const rounded = Math.round(amount);
  const withSpaces = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} XOF`;
}

export function formatCurrency(amount: number | null | undefined, code: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  if (code === 'XOF') return formatXOF(amount);
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatDate(date: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en', opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
