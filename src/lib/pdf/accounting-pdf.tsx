import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AccountingReport } from '@/lib/data/accounting';

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  wordmark: { fontSize: 12, letterSpacing: 3, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 9, color: '#888', marginTop: 2 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  meta: { fontSize: 10, color: '#666', marginTop: 4 },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#444', fontFamily: 'Helvetica-Bold' },
  hint: { fontSize: 9, color: '#888', marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.3, borderColor: '#eee' },
  rowStrong: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 0.5, borderColor: '#000' },
  label: { color: '#444' },
  totalLabel: { fontFamily: 'Helvetica-Bold' },
  total: { fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 32, borderTopWidth: 0.5, borderColor: '#eee', paddingTop: 12, fontSize: 8, color: '#888', textAlign: 'center' },
});

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

export function AccountingPdf({ report, generatedOn }: { report: AccountingReport; generatedOn: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.wordmark}>TIBI</Text>
        <Text style={styles.sub}>COTONOU</Text>

        <Text style={styles.h1}>Accounting report</Text>
        <Text style={styles.meta}>{report.scope.label} · generated {generatedOn}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tibi taxable revenue (CA imposable)</Text>
          <Text style={[styles.hint]}>= commissions consignation + ventes wholesale + ventes Tibi Editions</Text>
          <View style={styles.rowStrong}>
            <Text style={styles.totalLabel}>Total CA imposable</Text>
            <Text style={styles.total}>{fmt(report.tibi_taxable_revenue_xof)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consignation</Text>
          <Text style={styles.hint}>Tibi collecte pour le compte des marques. Seule la commission est un revenu Tibi.</Text>
          <View style={styles.row}><Text style={styles.label}>Collecté pour les marques</Text><Text>{fmt(report.consignment.gross_collected_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Commissions Tibi (revenu)</Text><Text>{fmt(report.consignment.commissions_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Dû aux marques</Text><Text>{fmt(report.consignment.due_to_brands_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Payé aux marques</Text><Text>{fmt(report.consignment.paid_to_brands_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Solde à payer</Text><Text>{fmt(report.consignment.balance_due_xof)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wholesale</Text>
          <Text style={styles.hint}>Produits achetés par Tibi et revendus. Marge totale pour Tibi.</Text>
          <View style={styles.row}><Text style={styles.label}>Ventes</Text><Text>{fmt(report.wholesale.sales_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Coût d&rsquo;achat (COGS)</Text><Text>{fmt(report.wholesale.cogs_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Marge brute</Text><Text>{fmt(report.wholesale.gross_margin_xof)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tibi Editions (own label)</Text>
          <Text style={styles.hint}>Produits Tibi. Marge totale pour Tibi.</Text>
          <View style={styles.row}><Text style={styles.label}>Ventes</Text><Text>{fmt(report.own_label.sales_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Coût de production (COGS)</Text><Text>{fmt(report.own_label.cogs_xof)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Marge brute</Text><Text>{fmt(report.own_label.gross_margin_xof)}</Text></View>
        </View>

        <Text style={styles.footer}>hello@ismathlauriano.com · Cotonou, Bénin</Text>
      </Page>
    </Document>
  );
}
