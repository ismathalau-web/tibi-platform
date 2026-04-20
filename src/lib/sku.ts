/**
 * Pure SKU helpers — safe to import from client or server code.
 */

export function brandCode(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return normalized.slice(0, 3).padEnd(3, 'X');
}

export function tokenize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function buildSku(params: {
  brandName: string;
  num: number;
  size: string | null;
  color: string | null;
}): string {
  const parts = [
    'TIBI',
    brandCode(params.brandName),
    params.num.toString().padStart(4, '0'),
    tokenize(params.size),
    tokenize(params.color),
  ].filter(Boolean);
  return parts.join('-');
}
