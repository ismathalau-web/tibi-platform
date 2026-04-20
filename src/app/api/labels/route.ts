import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { LabelsPdf, labelBarcodeDataUrl } from '@/lib/pdf/labels-pdf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return new NextResponse('Unauthorized', { status: 401 });

  const { variant_ids } = (await req.json()) as { variant_ids: string[] };
  if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
    return new NextResponse('variant_ids required', { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['label_size', 'label_barcode', 'label_content']);
  const settings = new Map<string, unknown>((settingsRows ?? []).map((r: any) => [r.key, r.value]));
  const size = (settings.get('label_size') ?? '40x30') as '40x30' | '50x30' | '60x40';
  const barcode = (settings.get('label_barcode') ?? 'code128') as 'code128' | 'qr' | 'ean13';
  const content = (settings.get('label_content') ?? 'sku_name_price') as 'sku_name_price' | 'sku_name' | 'sku';

  const { data: variants } = await supabase
    .from('variants')
    .select('id, sku, size, color, retail_price_xof, products!inner(name), brands!inner(name)')
    .in('id', variant_ids);

  const labels = await Promise.all(
    (variants ?? []).map(async (v: any) => ({
      sku: v.sku,
      name: v.products.name,
      brand: v.brands.name,
      size: v.size,
      color: v.color,
      retail_price_xof: v.retail_price_xof,
      barcodeDataUrl: await labelBarcodeDataUrl(v.sku, barcode),
    })),
  );

  const buffer = await renderToBuffer(LabelsPdf({ labels, size, content }) as any);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-labels.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
