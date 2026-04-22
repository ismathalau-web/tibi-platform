import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SalesReport, BrandsReport, InventoryReport, WholesaleReport } from '@/lib/data/reports';

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },
  wordmark: { fontSize: 11, letterSpacing: 3, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 8, color: '#888', marginTop: 2 },
  h1: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 12 },
  meta: { fontSize: 9, color: '#666', marginTop: 3 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#444', fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.3, borderColor: '#eee' },
  label: { color: '#444' },
  tableHead: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderColor: '#bbb' },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.3, borderColor: '#eee' },
  th: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  footer: { marginTop: 24, borderTopWidth: 0.5, borderColor: '#eee', paddingTop: 8, fontSize: 7, color: '#888', textAlign: 'center' },
  stat: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
});

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}
function pct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

interface Props {
  sales: SalesReport;
  brands: BrandsReport;
  inventory: InventoryReport;
  wholesale: WholesaleReport;
  generatedOn: string;
}

export function ReportsPdf({ sales, brands, inventory, wholesale, generatedOn }: Props) {
  return (
    <Document>
      {/* ---- Page 1: Sales ---- */}
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>TIBI</Text>
        <Text style={s.sub}>COTONOU</Text>
        <Text style={s.h1}>Reports</Text>
        <Text style={s.meta}>
          {new Date(sales.since).toLocaleDateString('en')} → {new Date(sales.until).toLocaleDateString('en')} · generated {generatedOn}
        </Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Sales</Text>
          <View style={s.gridRow}><Text style={s.label}>GMV (marchandise vendue)</Text><Text style={s.stat}>{fmt(sales.gmv_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Tibi CA (commissions + wholesale)</Text><Text>{fmt(sales.tibi_revenue_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Transactions</Text><Text>{sales.tx_count}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Average basket</Text><Text>{fmt(sales.average_basket_xof)}</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>By payment method</Text>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 3 }]}>Method</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>GMV</Text>
          </View>
          {sales.by_payment.map((p, i) => (
            <View key={i} style={s.row}>
              <Text style={{ flex: 3 }}>{p.method}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{fmt(p.total_xof)}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>By seller</Text>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 3 }]}>Seller</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Tx</Text>
            <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>GMV</Text>
          </View>
          {sales.by_seller.map((r, i) => (
            <View key={i} style={s.row}>
              <Text style={{ flex: 3 }}>{r.seller}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{r.tx}</Text>
              <Text style={{ flex: 2, textAlign: 'right' }}>{fmt(r.total_xof)}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Top 10 items</Text>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 4 }]}>Item</Text>
            <Text style={[s.th, { flex: 2 }]}>Brand</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Qty</Text>
            <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>GMV</Text>
          </View>
          {sales.top_items.map((t, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={{ flex: 4 }}>{t.product}</Text>
              <Text style={{ flex: 2, color: '#666' }}>{t.brand}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{t.qty}</Text>
              <Text style={{ flex: 2, textAlign: 'right' }}>{fmt(t.total_xof)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ---- Page 2: Brands ---- */}
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>TIBI</Text>
        <Text style={s.h1}>Brands</Text>
        <Text style={s.meta}>{brands.cycle_label}</Text>

        <View style={s.section}>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 3 }]}>Brand</Text>
            <Text style={[s.th, { flex: 1 }]}>Type</Text>
            <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>GMV</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Sold</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Sent</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Sell-thru</Text>
            <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>Commission</Text>
            <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>Stock value</Text>
          </View>
          {brands.rows.map((b, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={{ flex: 3 }}>{b.name}</Text>
              <Text style={{ flex: 1, color: '#666' }}>{b.type}</Text>
              <Text style={{ flex: 2, textAlign: 'right' }}>{fmt(b.gmv_xof)}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{b.units_sold}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{b.units_sent}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{pct(b.sell_through_pct)}</Text>
              <Text style={{ flex: 2, textAlign: 'right' }}>{b.type === 'consignment' ? fmt(b.commission_xof) : '—'}</Text>
              <Text style={{ flex: 2, textAlign: 'right' }}>{fmt(b.stock_value_xof)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ---- Page 3: Inventory ---- */}
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>TIBI</Text>
        <Text style={s.h1}>Inventory</Text>
        <Text style={s.meta}>{inventory.cycle_label}</Text>

        <View style={s.section}>
          <View style={s.gridRow}><Text style={s.label}>Total stock value (retail)</Text><Text style={s.stat}>{fmt(inventory.total_stock_value_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Items in stock</Text><Text>{inventory.total_items_in_stock}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Balance due to brands</Text><Text>{fmt(inventory.total_balance_due_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Low-stock alerts</Text><Text>{inventory.alerts_count} items ≤ {inventory.alert_threshold}</Text></View>
          {inventory.projection && (
            <>
              <View style={s.gridRow}><Text style={s.label}>Current sell rate / day</Text><Text>{fmt(Math.round(inventory.projection.current_sell_rate_per_day))}</Text></View>
              <View style={s.gridRow}><Text style={s.label}>Days left in cycle</Text><Text>{inventory.projection.days_left}</Text></View>
              <View style={s.gridRow}><Text style={s.label}>Projected end-of-cycle GMV</Text><Text style={s.stat}>{fmt(inventory.projection.projected_end_of_cycle_gmv_xof)}</Text></View>
            </>
          )}
          {inventory.cycle_vs_previous?.previous && (
            <>
              <View style={s.gridRow}><Text style={s.label}>{inventory.cycle_vs_previous.current.name}</Text><Text>{fmt(inventory.cycle_vs_previous.current.gmv_xof)}</Text></View>
              <View style={s.gridRow}><Text style={s.label}>{inventory.cycle_vs_previous.previous.name}</Text><Text>{fmt(inventory.cycle_vs_previous.previous.gmv_xof)}</Text></View>
            </>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Low-stock alerts</Text>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 4 }]}>Brand</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Total stock left</Text>
          </View>
          {inventory.low_stock.map((r, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={{ flex: 4 }}>{r.brand}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{r.total_stock}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ---- Page 4: Wholesale & Editions ---- */}
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>TIBI</Text>
        <Text style={s.h1}>Wholesale & Editions</Text>
        <Text style={s.meta}>{wholesale.cycle_label}</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Wholesale</Text>
          <View style={s.gridRow}><Text style={s.label}>Stock value (cost)</Text><Text>{fmt(wholesale.wholesale.stock_value_cost_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Stock value (retail)</Text><Text>{fmt(wholesale.wholesale.stock_value_retail_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Sales</Text><Text>{fmt(wholesale.wholesale.sales_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>COGS</Text><Text>{fmt(wholesale.wholesale.cogs_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Gross margin</Text><Text style={s.stat}>{fmt(wholesale.wholesale.gross_margin_xof)} ({pct(wholesale.wholesale.gross_margin_pct, 1)})</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Tibi Editions</Text>
          <View style={s.gridRow}><Text style={s.label}>Stock value (cost)</Text><Text>{fmt(wholesale.own_label.stock_value_cost_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Stock value (retail)</Text><Text>{fmt(wholesale.own_label.stock_value_retail_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Sales</Text><Text>{fmt(wholesale.own_label.sales_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>COGS</Text><Text>{fmt(wholesale.own_label.cogs_xof)}</Text></View>
          <View style={s.gridRow}><Text style={s.label}>Gross margin</Text><Text style={s.stat}>{fmt(wholesale.own_label.gross_margin_xof)} ({pct(wholesale.own_label.gross_margin_pct, 1)})</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Total profit</Text>
          <Text style={[s.stat, { fontSize: 18 }]}>{fmt(wholesale.profit_total_xof)}</Text>
        </View>

        <Text style={s.footer}>hello@ismathlauriano.com · Cotonou, Bénin</Text>
      </Page>
    </Document>
  );
}
