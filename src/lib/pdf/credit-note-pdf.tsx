import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface ReturnedItem {
  name: string;
  brand: string;
  sku: string;
  qty: number;
  unit_price_xof: number;
  line_total_xof: number;
}

interface Props {
  creditNoteNo: number;
  invoiceNo: number;
  invoiceDate: string;
  date: string;
  items: ReturnedItem[];
  totalRefund: number;
  refundMethod: string;
  reason: string;
  notes: string | null;
  sellerName: string;
  customerName?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.5 },

  // Header
  header: { marginBottom: 36 },
  shopName: { fontSize: 11, letterSpacing: 2.5, fontFamily: 'Helvetica-Bold' },
  shopContact: { fontSize: 9, color: '#888', marginTop: 3 },

  // Title + meta
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, borderBottomWidth: 0.5, borderColor: '#e5e5e5', paddingBottom: 18 },
  docTitle: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5 },
  docNumber: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  metaBlock: { textAlign: 'right' },
  metaLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { fontSize: 10, marginTop: 2 },

  // Reference box
  refBox: { marginBottom: 22, padding: 12, borderRadius: 4, backgroundColor: '#f5f5f5' },
  refLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  refValue: { fontSize: 11, marginTop: 3 },

  // Items
  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#1a1a1a', paddingBottom: 6, marginBottom: 6 },
  th: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  col1: { flex: 4, paddingRight: 8 },
  col2: { flex: 2, paddingRight: 8 },
  col3: { flex: 0.8, textAlign: 'right', paddingRight: 8 },
  col4: { flex: 1.5, textAlign: 'right', paddingRight: 8 },
  col5: { flex: 1.7, textAlign: 'right' },
  itemSku: { color: '#aaa', fontSize: 8, marginTop: 1 },

  // Totals + context
  totalsBlock: { marginTop: 28, alignSelf: 'flex-end', width: '48%' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderColor: '#1a1a1a', paddingTop: 10, marginTop: 8 },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  grandTotalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },

  contextBlock: { marginTop: 22, fontSize: 10 },
  contextLabel: { color: '#888', fontSize: 8, textTransform: 'uppercase', letterSpacing: 1 },
  contextValue: { marginTop: 2, marginBottom: 10 },

  footer: { marginTop: 40, borderTopWidth: 0.5, borderColor: '#e5e5e5', paddingTop: 14, fontSize: 8, color: '#aaa', textAlign: 'center', letterSpacing: 0.5 },
});

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

function cnNumber(n: number) {
  return `CN-${String(n).padStart(4, '0')}`;
}

export function CreditNotePdf({
  creditNoteNo, invoiceNo, invoiceDate, date, items,
  totalRefund, refundMethod, reason, notes, sellerName, customerName,
}: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Shop header */}
        <View style={styles.header}>
          <Text style={styles.shopName}>TIBI CONCEPT STORE</Text>
          <Text style={styles.shopContact}>pos@tibiconceptstore.com   ·   Cotonou, Bénin</Text>
        </View>

        {/* Document title + date + customer */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.docTitle}>Credit note</Text>
            <Text style={styles.docNumber}>{cnNumber(creditNoteNo)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Issued</Text>
            <Text style={styles.metaValue}>{date}</Text>
            {customerName && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 8 }]}>Customer</Text>
                <Text style={styles.metaValue}>{customerName}</Text>
              </>
            )}
          </View>
        </View>

        {/* Reference to original invoice */}
        <View style={styles.refBox}>
          <Text style={styles.refLabel}>Against invoice</Text>
          <Text style={styles.refValue}>#{invoiceNo}   ·   {invoiceDate}</Text>
        </View>

        {/* Items returned */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.col1]}>Item returned</Text>
          <Text style={[styles.th, styles.col2]}>Brand</Text>
          <Text style={[styles.th, styles.col3]}>Qty</Text>
          <Text style={[styles.th, styles.col4]}>Unit price</Text>
          <Text style={[styles.th, styles.col5]}>Refund</Text>
        </View>

        {items.map((it, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <View style={styles.col1}>
              <Text>{it.name}</Text>
              <Text style={styles.itemSku}>{it.sku}</Text>
            </View>
            <Text style={styles.col2}>{it.brand}</Text>
            <Text style={styles.col3}>{it.qty}</Text>
            <Text style={styles.col4}>{fmt(it.unit_price_xof)}</Text>
            <Text style={styles.col5}>{fmt(it.line_total_xof)}</Text>
          </View>
        ))}

        {/* Total refund */}
        <View style={styles.totalsBlock}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total refund</Text>
            <Text style={styles.grandTotalValue}>{fmt(totalRefund)}</Text>
          </View>
        </View>

        {/* Reason / method / notes */}
        <View style={styles.contextBlock}>
          <Text style={styles.contextLabel}>Reason</Text>
          <Text style={styles.contextValue}>{reason}</Text>

          <Text style={styles.contextLabel}>Refund method</Text>
          <Text style={styles.contextValue}>{refundMethod.replace('_', ' ')}</Text>

          <Text style={styles.contextLabel}>Processed by</Text>
          <Text style={styles.contextValue}>{sellerName}</Text>

          {notes && (
            <>
              <Text style={styles.contextLabel}>Notes</Text>
              <Text style={styles.contextValue}>{notes}</Text>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          This credit note refers to invoice #{invoiceNo} and does not replace it.
        </Text>
      </Page>
    </Document>
  );
}
