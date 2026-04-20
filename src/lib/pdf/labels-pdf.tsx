import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import bwipjs from 'bwip-js';

type LabelSize = '40x30' | '50x30' | '60x40';
type Barcode = 'code128' | 'qr' | 'ean13';
type Content = 'sku_name_price' | 'sku_name' | 'sku';

const sizes: Record<LabelSize, { width: number; height: number }> = {
  '40x30': { width: 40, height: 30 },
  '50x30': { width: 50, height: 30 },
  '60x40': { width: 60, height: 40 },
};

function mm(n: number) {
  return `${n}mm`;
}

interface LabelData {
  sku: string;
  name: string;
  brand: string;
  size: string | null;
  color: string | null;
  retail_price_xof: number;
}

export async function labelBarcodeDataUrl(value: string, bcid: Barcode): Promise<string> {
  const symbology = bcid === 'qr' ? 'qrcode' : bcid === 'ean13' ? 'ean13' : 'code128';
  try {
    const buffer = await bwipjs.toBuffer({
      bcid: symbology,
      text: value,
      scale: 2,
      height: 8,
      includetext: false,
      backgroundcolor: 'FFFFFF',
      paddingwidth: 2,
      paddingheight: 2,
    });
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

interface Props {
  labels: Array<LabelData & { barcodeDataUrl: string }>;
  size: LabelSize;
  content: Content;
}

export function LabelsPdf({ labels, size, content }: Props) {
  const dims = sizes[size];
  const styles = StyleSheet.create({
    page: {
      padding: mm(2),
      fontSize: 7,
      fontFamily: 'Helvetica',
      color: '#1a1a1a',
    },
    wordmark: { fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, fontSize: 7, textAlign: 'center' },
    rule: { borderBottomWidth: 0.3, borderColor: '#000', marginVertical: 1 },
    name: { fontSize: 7, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
    meta: { fontSize: 6, textAlign: 'center', color: '#444' },
    price: { fontSize: 7, textAlign: 'center', fontFamily: 'Helvetica-Bold', marginTop: 1 },
    sku: { fontSize: 5, textAlign: 'center', color: '#888', marginTop: 1 },
    barcode: { marginVertical: 1, alignSelf: 'center' },
  });

  return (
    <Document>
      {labels.map((l, i) => (
        <Page key={i} size={{ width: mm(dims.width), height: mm(dims.height) }} style={styles.page}>
          <Text style={styles.wordmark}>TIBI</Text>
          <View style={styles.rule} />
          {content !== 'sku' && <Text style={styles.name}>{truncate(l.name, 24)}</Text>}
          {content !== 'sku' && (
            <Text style={styles.meta}>
              {[l.brand, l.size, l.color].filter(Boolean).join(' · ')}
            </Text>
          )}
          {content === 'sku_name_price' && <Text style={styles.price}>{fmt(l.retail_price_xof)}</Text>}
          {l.barcodeDataUrl && (
            <Image src={l.barcodeDataUrl} style={{ height: mm(8), marginVertical: mm(0.5) }} />
          )}
          <Text style={styles.sku}>{l.sku}</Text>
        </Page>
      ))}
    </Document>
  );
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
