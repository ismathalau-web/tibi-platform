import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdf } from '@/lib/pdf/invoice-pdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = createAdminClient();
  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, subtotal_xof, discount_xof, discount_reason, total_xof, payment_method, seller_name, customer_name')
    .eq('id', params.id)
    .maybeSingle();
  if (error || !sale) return new NextResponse('Not found', { status: 404 });

  // All authenticated users (admin + seller) can view any invoice.
  // Read access is needed to handle returns, exchanges, and customer service
  // without admin intervention. Modifying a sale remains admin-restricted in
  // server actions that edit or void sales.

  const { data: items } = await supabase
    .from('sale_items')
    .select('qty, unit_price_xof, variants!inner(sku, products!inner(name)), brands!inner(name)')
    .eq('sale_id', params.id);

  const formatted = (items ?? []).map((it: any) => ({
    name: it.variants.products.name,
    brand: it.brands.name,
    sku: it.variants.sku,
    qty: it.qty,
    unit_price_xof: it.unit_price_xof,
    line_total_xof: it.qty * it.unit_price_xof,
  }));

  const buffer = await renderToBuffer(
    InvoicePdf({
      invoiceNo: sale.invoice_no,
      date: new Date(sale.created_at).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }),
      items: formatted,
      subtotal: sale.subtotal_xof,
      discount: sale.discount_xof,
      discountReason: sale.discount_reason,
      total: sale.total_xof,
      paymentMethod: sale.payment_method,
      sellerName: sale.seller_name,
      customerName: sale.customer_name,
    }) as any,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-invoice-${sale.invoice_no}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
