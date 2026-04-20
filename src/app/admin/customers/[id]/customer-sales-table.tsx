'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { formatXOF } from '@/lib/format';

interface SaleRow {
  id: string;
  invoice_no: number;
  created_at: string;
  total_xof: number;
  payment_method: string;
  seller_name: string;
  is_locked: boolean;
  voided_at: string | null;
}

export function CustomerSalesTable({ rows }: { rows: SaleRow[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="tibi-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>When</th>
            <th>Seller</th>
            <th>Payment</th>
            <th className="text-right">Total</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="text-center text-ink-hint py-10">No sales yet.</td></tr>
          ) : rows.map((s) => (
            <tr
              key={s.id}
              className="cursor-pointer"
              onClick={() => router.push(`/admin/sales/${s.id}`)}
            >
              <td className="font-mono text-[12px]">#{s.invoice_no}</td>
              <td className="text-ink-secondary">
                {new Date(s.created_at).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}
                {s.voided_at && <Badge tone="danger" className="ml-2">Voided</Badge>}
                {!s.voided_at && s.is_locked && <Badge tone="neutral" className="ml-2">Closed</Badge>}
              </td>
              <td>{s.seller_name}</td>
              <td className="text-ink-secondary capitalize">{s.payment_method.replace('_', ' ')}</td>
              <td className="text-right font-medium tabular-nums">{formatXOF(s.total_xof)}</td>
              <td className="text-ink-hint text-center">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
