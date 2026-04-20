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
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statLabel: { color: '#444' },
  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ccc', paddingBottom: 6, marginBottom: 6 },
  th: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: '#eee' },
  col1: { flex: 2.6, paddingRight: 6 },
  col2: { flex: 2.6, paddingRight: 6 },
  col3: { flex: 0.8, paddingRight: 6 },
  col4: { flex: 1.2, paddingRight: 6 },
  col5: { flex: 0.9, textAlign: 'right', paddingRight: 6 },
  col6: { flex: 0.9, textAlign: 'right' },
  footer: { marginTop: 32, borderTopWidth: 0.5, borderColor: '#eee', paddingTop: 12, fontSize: 8, color: '#888', textAlign: 'center' },
});

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

export function BrandReportPdf({ brandName, cycleName, commissionPct, sent, sold, remaining, balanceDueXof, paidXof, stock, date }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.wordmark}>TIBI</Text>
        <Text style={styles.sub}>COTONOU</Text>

        <Text style={styles.h1}>{brandName}</Text>
        <Text style={styles.meta}>
          {cycleName ?? '—'}
          {commissionPct != null ? ` · Commission: ${commissionPct}%` : ''}
          {'  ·  '}{date}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cycle summary</Text>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Items sent</Text><Text>{sent}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Items sold</Text><Text>{sold}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Items remaining</Text><Text>{remaining}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Balance due</Text><Text>{fmt(balanceDueXof)}</Text></View>
          <View style={styles.statsRow}><Text style={styles.statLabel}>Paid to date</Text><Text>{fmt(paidXof)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.col1]}>Item</Text>
            <Text style={[styles.th, styles.col2]}>SKU</Text>
            <Text style={[styles.th, styles.col3]}>Size</Text>
            <Text style={[styles.th, styles.col4]}>Color</Text>
            <Text style={[styles.th, styles.col5]}>Sent</Text>
            <Text style={[styles.th, styles.col6]}>Sold</Text>
          </View>
          {stock.map((r, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.col1}>{r.product_name}</Text>
              <Text style={[styles.col2, { fontSize: 8, color: '#888' }]}>{r.sku}</Text>
              <Text style={styles.col3}>{r.size ?? '—'}</Text>
              <Text style={styles.col4}>{r.color ?? '—'}</Text>
              <Text style={styles.col5}>{r.qty_sent}</Text>
              <Text style={styles.col6}>{r.qty_sold}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>hello@ismathlauriano.com · Cotonou, Bénin</Text>
      </Page>
    </Document>
  );
}
