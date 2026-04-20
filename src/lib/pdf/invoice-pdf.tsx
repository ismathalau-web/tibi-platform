import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface InvoiceItem {
  name: string;
  brand: string;
  sku: string;
  qty: number;
  unit_price_xof: number;
  line_total_xof: number;
}

interface Props {
  invoiceNo: number;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountReason: string | null;
  total: number;
  paymentMethod: string;
  sellerName: string;
  customerName?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.5 },

  // Header block
  header: { marginBottom: 36 },
  shopName: { fontSize: 11, letterSpacing: 2.5, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  shopContact: { fontSize: 9, color: '#888', marginTop: 3 },

  // Invoice meta row
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, borderBottomWidth: 0.5, borderColor: '#e5e5e5', paddingBottom: 18 },
  invoiceTitle: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5 },
  invoiceNumber: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 4, color: '#1a1a1a' },
  metaBlock: { textAlign: 'right' },
  metaLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { fontSize: 10, color: '#1a1a1a', marginTop: 2 },

  // Items table
  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#1a1a1a', paddingBottom: 6, marginBottom: 6 },
  th: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  col1: { flex: 4, paddingRight: 8 },
  col2: { flex: 2, paddingRight: 8 },
  col3: { flex: 0.8, textAlign: 'right', paddingRight: 8 },
  col4: { flex: 1.5, textAlign: 'right', paddingRight: 8 },
  col5: { flex: 1.7, textAlign: 'right' },
  itemName: { color: '#1a1a1a' },
  itemSku: { color: '#aaa', fontSize: 8, marginTop: 1 },

  // Totals
  totalsBlock: { marginTop: 28, alignSelf: 'flex-end', width: '48%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalsLabel: { color: '#555' },
  totalsValue: { color: '#1a1a1a' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderColor: '#1a1a1a', paddingTop: 10, marginTop: 8 },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  grandTotalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },

  // Payment + footer
  paymentInfo: { marginTop: 22, fontSize: 9, color: '#888', alignSelf: 'flex-end', width: '48%' },
  footer: { marginTop: 40, borderTopWidth: 0.5, borderColor: '#e5e5e5', paddingTop: 14, fontSize: 8, color: '#aaa', textAlign: 'center', letterSpacing: 0.5 },
});

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

export function InvoicePdf({ invoiceNo, date, items, subtotal, discount, discountReason, total, paymentMethod, sellerName, customerName }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header — shop identity */}
        <View style={styles.header}>
          <Text style={styles.shopName}>TIBI CONCEPT STORE</Text>
          <Text style={styles.shopContact}>pos@tibiconceptstore.com   ·   Cotonou, Bénin</Text>
        </View>

        {/* Invoice # / Date / Customer meta row */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceNumber}>#{invoiceNo}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{date}</Text>
            {customerName && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 8 }]}>Customer</Text>
                <Text style={styles.metaValue}>{customerName}</Text>
              </>
            )}
          </View>
        </View>

        {/* Items */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.col1]}>Item</Text>
          <Text style={[styles.th, styles.col2]}>Brand</Text>
          <Text style={[styles.th, styles.col3]}>Qty</Text>
          <Text style={[styles.th, styles.col4]}>Unit price</Text>
          <Text style={[styles.th, styles.col5]}>Total</Text>
        </View>

        {items.map((it, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <View style={styles.col1}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemSku}>{it.sku}</Text>
            </View>
            <Text style={styles.col2}>{it.brand}</Text>
            <Text style={styles.col3}>{it.qty}</Text>
            <Text style={styles.col4}>{fmt(it.unit_price_xof)}</Text>
            <Text style={styles.col5}>{fmt(it.line_total_xof)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmt(subtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Discount{discountReason ? `  ·  ${discountReason}` : ''}
              </Text>
              <Text style={styles.totalsValue}>−{fmt(discount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Payment method + seller (discreet) */}
        <View style={styles.paymentInfo}>
          <Text>Paid by {paymentMethod}  ·  Sold by {sellerName}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Thank you for your purchase</Text>
      </Page>
    </Document>
  );
}
