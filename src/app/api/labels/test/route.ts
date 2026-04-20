import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { LabelsPdf, labelBarcodeDataUrl } from '@/lib/pdf/labels-pdf';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return new NextResponse('Unauthorized', { status: 401 });

  const supabase = createAdminClient();
  const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['label_size', 'label_barcode', 'label_content']);
  const settings = new Map<string, unknown>((settingsRows ?? []).map((r: any) => [r.key, r.value]));
  const size = (settings.get('label_size') ?? '40x30') as '40x30' | '50x30' | '60x40';
  const barcode = (settings.get('label_barcode') ?? 'code128') as 'code128' | 'qr' | 'ean13';
  const content = (settings.get('label_content') ?? 'sku_name_price') as 'sku_name_price' | 'sku_name' | 'sku';

  const sample = [
    {
      sku: 'TIBI-SAMPLE-0001-M-NOIR',
      name: 'Sample item',
      brand: 'Tibi Editions',
      size: 'M',
      color: 'Noir',
      retail_price_xof: 25000,
      barcodeDataUrl: await labelBarcodeDataUrl('TIBI-SAMPLE-0001-M-NOIR', barcode),
    },
  ];

  const buffer = await renderToBuffer(LabelsPdf({ labels: sample, size, content }) as any);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="tibi-label-test.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
