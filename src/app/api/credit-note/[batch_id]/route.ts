import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { CreditNotePdf } from '@/lib/pdf/credit-note-pdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { safeFilename } from '@/lib/safe-filename';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { batch_id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = createAdminClient();

  const { data: batch, error: bErr } = await supabase
    .from('return_batches')
    .select('id, credit_note_no, sale_id, total_refund_xof, refund_method, reason, notes, seller_name, created_at')
    .eq('id', params.batch_id)
    .maybeSingle();
  if (bErr || !batch) return new NextResponse('Not found', { status: 404 });

  const { data: sale, error: sErr } = await supabase
    .from('sales')
    .select('invoice_no, created_at, customer_name')
    .eq('id', (batch as any).sale_id)
    .maybeSingle();
  if (sErr || !sale) return new NextResponse('Parent sale not found', { status: 404 });

  // All returns in this batch
  const { data: items } = await supabase
    .from('returns')
    .select(`
      qty, refund_xof,
      sale_items!inner(
        unit_price_xof,
        variants!inner(sku, products!inner(name)),
        brands!inner(name)
      )
    `)
    .eq('batch_id', params.batch_id);

  const formatted = ((items ?? []) as any[]).map((r) => ({
    name: r.sale_items.variants.products.name,
    brand: r.sale_items.brands.name,
    sku: r.sale_items.variants.sku,
    qty: r.qty,
    unit_price_xof: r.sale_items.unit_price_xof,
    line_total_xof: r.refund_xof,
  }));

  const buffer = await renderToBuffer(
    CreditNotePdf({
      creditNoteNo: (batch as any).credit_note_no,
      invoiceNo: (sale as any).invoice_no,
      invoiceDate: new Date((sale as any).created_at).toLocaleDateString('en', { dateStyle: 'medium' }),
      date: new Date((batch as any).created_at).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }),
      items: formatted,
      totalRefund: (batch as any).total_refund_xof,
      refundMethod: (batch as any).refund_method,
      reason: (batch as any).reason,
      notes: (batch as any).notes,
      sellerName: (batch as any).seller_name,
      customerName: (sale as any).customer_name,
    }) as any,
  );

  const cnLabel = `CN-${String((batch as any).credit_note_no).padStart(4, '0')}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-${safeFilename(cnLabel)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
