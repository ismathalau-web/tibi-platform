import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { CancellationNotePdf } from '@/lib/pdf/cancellation-note-pdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { safeFilename } from '@/lib/safe-filename';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { sale_id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = createAdminClient();

  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, voided_at, voided_reason, cancellation_note_no, customer_name, total_xof')
    .eq('id', params.sale_id)
    .maybeSingle();
  if (error || !sale) return new NextResponse('Not found', { status: 404 });
  if (!(sale as any).voided_at || !(sale as any).cancellation_note_no) {
    return new NextResponse('Sale is not voided', { status: 404 });
  }

  // Items on the sale
  const { data: items } = await supabase
    .from('sale_items')
    .select('qty, unit_price_xof, variants!inner(sku, products!inner(name)), brands!inner(name)')
    .eq('sale_id', params.sale_id);

  const formatted = ((items ?? []) as any[]).map((it) => ({
    name: it.variants.products.name,
    brand: it.brands.name,
    sku: it.variants.sku,
    qty: it.qty,
    unit_price_xof: it.unit_price_xof,
    line_total_xof: it.qty * it.unit_price_xof,
  }));

  // Who voided: find the 'voided' audit entry
  const { data: auditRow } = await supabase
    .from('sale_audit_log')
    .select('actor, details')
    .eq('sale_id', params.sale_id)
    .eq('action', 'voided')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const voidedBy = (auditRow as any)?.actor ?? 'staff';

  const buffer = await renderToBuffer(
    CancellationNotePdf({
      cancellationNoteNo: (sale as any).cancellation_note_no,
      invoiceNo: (sale as any).invoice_no,
      invoiceDate: new Date((sale as any).created_at).toLocaleDateString('en', { dateStyle: 'medium' }),
      date: new Date((sale as any).voided_at).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }),
      items: formatted,
      total: (sale as any).total_xof,
      reason: (sale as any).voided_reason ?? '—',
      voidedBy,
      customerName: (sale as any).customer_name,
    }) as any,
  );

  const canLabel = `CAN-${String((sale as any).cancellation_note_no).padStart(4, '0')}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-${safeFilename(canLabel)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
