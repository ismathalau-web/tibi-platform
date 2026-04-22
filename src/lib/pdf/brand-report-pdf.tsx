import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface StockRow {
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  retail_price_xof: number;
  qty_sent: number;
  qty_sold: number;
  qty_remaining: number;
}

interface SaleDetailRow {
  sold_at: string;
  invoice_no: number;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  qty_sold: number;
  unit_price_xof: number;
  unit_brand_share_xof: number;
  total_brand_share_xof: number;
}

interface Props {
  brandName: string;
  cycleName: string | null;
  commissionPct: number | null;
  sent: number;
  sold: number;
  remaining: number;
  balanceDueXof: number;
  paidXof: number;
  stock: StockRow[];
  salesDetail: SaleDetailRow[];
  date: string;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  wordmark: { fontSize: 12, letterSpacing: 3, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 9, color: '#888', marginTop: 2 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  meta: { fontSize: 10, color: '#666', marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8 },
  legend: { fontSize: 8, color: '#888', marginBottom: 8, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statLabel: { color: '#444' },
  statBig: { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#1a1a1a', paddingBottom: 6, marginBottom: 6 },
  th: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: '#eee' },

  // Stock columns: Item · SKU · Size · Color · Retail · Your share/u · Sent · Sold · Remaining
  s1: { flex: 2.4, paddingRight: 6 },
  s2: { flex: 2, paddingRight: 6 },
  s3: { flex: 0.7, paddingRight: 6 },
  s4: { flex: 1, paddingRight: 6 },
  s5: { flex: 1.2, textAlign: 'right', paddingRight: 6 },
  s6: { flex: 1.2, textAlign: 'right', paddingRight: 6 },
  s7: { flex: 0.6, textAlign: 'right', paddingRight: 6 },
  s8: { flex: 0.6, textAlign: 'right', paddingRight: 6 },
  s9: { flex: 0.8, textAlign: 'right' },

  // Sales detail columns: Date · Invoice · Item · Qty · Retail/u · Share/u · Total share
  d1: { flex: 1.4, paddingRight: 6 },
  d2: { flex: 0.8, paddingRight: 6 },
  d3: { flex: 2.4, paddingRight: 6 },
  d4: { flex: 0.5, textAlign: 'right', paddingRight: 6 },
  d5: { flex: 1.2, textAlign: 'right', paddingRight: 6 },
  d6: { flex: 1.2, textAlign: 'right', paddingRight: 6 },
  d7: { flex: 1.4, textAlign: 'right' },

  totalRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 0.5, borderColor: '#1a1a1a', marginTop: 4 },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },

  footer: { marginTop: 32, borderTopWidth: 0.5, borderColor: '#eee', paddingTop: 12, fontSize: 8, color: '#888', textAlign: 'center' },
});

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

function dateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en', { dateStyle: 'short' });
}

export function BrandReportPdf({
  brandName, cycleName, commissionPct, sent, sold, remaining, balanceDueXof, paidXof, stock, salesDetail, date,
}: Props) {
  const totalQty = salesDetail.reduce((s, r) => s + r.qty_sold, 0);
  const totalShare = salesDetail.reduce((s, r) => s + r.total_brand_share_xof, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.wordmark}>TIBI CONCEPT STORE</Text>
        <Text style={styles.sub}>pos@tibiconceptstore.com   ·   Cotonou, Bénin</Text>

        <Text style={styles.h1}>{brandName}</Text>
        <Text style={styles.meta}>
          {cycleName ?? '—'}
          {commissionPct != null ? ` · Commission: ${commissionPct}%` : ''}
          {'  ·  '}{date}
        </Text>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cycle summary</Text>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Items sent</Text><Text>{sent}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Items sold</Text><Text>{sold}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Items remaining</Text><Text>{remaining}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Paid to date</Text><Text>{fmt(paidXof)}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statBig}>Balance due</Text><Text style={styles.statBig}>{fmt(balanceDueXof)}</Text></View>
        </View>

        {/* Stock */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock</Text>
          <Text style={styles.legend}>
            Retail price = what the customer pays.   Your share = retail price minus Tibi commission.
          </Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.s1]}>Item</Text>
            <Text style={[styles.th, styles.s2]}>SKU</Text>
            <Text style={[styles.th, styles.s3]}>Size</Text>
            <Text style={[styles.th, styles.s4]}>Color</Text>
            <Text style={[styles.th, styles.s5]}>Retail</Text>
            <Text style={[styles.th, styles.s6]}>Your share/u</Text>
            <Text style={[styles.th, styles.s7]}>Sent</Text>
            <Text style={[styles.th, styles.s8]}>Sold</Text>
            <Text style={[styles.th, styles.s9]}>Left</Text>
          </View>
          {stock.map((r, i) => {
            const yourShare = Math.round(r.retail_price_xof * (1 - (commissionPct ?? 0) / 100));
            return (
              <View key={i} style={styles.row} wrap={false}>
                <Text style={styles.s1}>{r.product_name}</Text>
                <Text style={[styles.s2, { fontSize: 8, color: '#888' }]}>{r.sku}</Text>
                <Text style={styles.s3}>{r.size ?? '—'}</Text>
                <Text style={styles.s4}>{r.color ?? '—'}</Text>
                <Text style={styles.s5}>{fmt(r.retail_price_xof)}</Text>
                <Text style={styles.s6}>{fmt(yourShare)}</Text>
                <Text style={styles.s7}>{r.qty_sent}</Text>
                <Text style={styles.s8}>{r.qty_sold}</Text>
                <Text style={styles.s9}>{r.qty_remaining}</Text>
              </View>
            );
          })}
        </View>

        {/* Sales detail */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales detail {cycleName ? `· ${cycleName}` : ''}</Text>
          <Text style={styles.legend}>
            Each sale of your items, net of returns. Voided sales excluded.
          </Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.d1]}>Date</Text>
            <Text style={[styles.th, styles.d2]}>Invoice</Text>
            <Text style={[styles.th, styles.d3]}>Item</Text>
            <Text style={[styles.th, styles.d4]}>Qty</Text>
            <Text style={[styles.th, styles.d5]}>Retail/u</Text>
            <Text style={[styles.th, styles.d6]}>Share/u</Text>
            <Text style={[styles.th, styles.d7]}>Total share</Text>
          </View>
          {salesDetail.length === 0 ? (
            <Text style={{ fontSize: 9, color: '#888', paddingVertical: 8 }}>No sales yet for this cycle.</Text>
          ) : salesDetail.map((r, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.d1}>{dateOnly(r.sold_at)}</Text>
              <Text style={[styles.d2, { fontSize: 8, color: '#888' }]}>#{r.invoice_no}</Text>
              <Text style={styles.d3}>
                {r.product_name}
                {(r.size || r.color) ? ` (${[r.size, r.color].filter(Boolean).join(' · ')})` : ''}
              </Text>
              <Text style={styles.d4}>{r.qty_sold}</Text>
              <Text style={styles.d5}>{fmt(r.unit_price_xof)}</Text>
              <Text style={styles.d6}>{fmt(r.unit_brand_share_xof)}</Text>
              <Text style={styles.d7}>{fmt(r.total_brand_share_xof)}</Text>
            </View>
          ))}
          {salesDetail.length > 0 && (
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.totalLabel, styles.d1]}>Total</Text>
              <Text style={styles.d2}></Text>
              <Text style={styles.d3}></Text>
              <Text style={[styles.d4, { fontFamily: 'Helvetica-Bold' }]}>{totalQty}</Text>
              <Text style={styles.d5}></Text>
              <Text style={styles.d6}></Text>
              <Text style={[styles.d7, { fontFamily: 'Helvetica-Bold' }]}>{fmt(totalShare)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>pos@tibiconceptstore.com · Cotonou, Bénin</Text>
      </Page>
    </Document>
  );
}
