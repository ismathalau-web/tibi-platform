import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireAdmin } from '@/lib/auth';
import { getAccountingReport, type Scope } from '@/lib/data/accounting';
import { AccountingPdf } from '@/lib/pdf/accounting-pdf';
import { safeFilename } from '@/lib/safe-filename';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await requireAdmin();
  const sp = req.nextUrl.searchParams;

  let scope: Scope;
  if (sp.get('scope') === 'month') {
    const now = new Date();
    scope = {
      type: 'month',
      year: Number(sp.get('year') ?? now.getFullYear()),
      month: Number(sp.get('month') ?? now.getMonth() + 1),
    };
  } else {
    scope = { type: 'cycle', cycleId: sp.get('cycle') ?? undefined };
  }

  const report = await getAccountingReport(scope);

  if (sp.get('format') === 'csv') {
    const r = report;
    const generated = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const lines: string[] = [];

    function row(...cells: unknown[]): string {
      return cells.map((c) => {
        if (c === null || c === undefined) return '';
        const s = String(c);
        return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',');
    }
    function blank() { lines.push(''); }
    function header(label: string) {
      blank();
      lines.push(row(`=== ${label.toUpperCase()} ===`));
    }
    function kv(label: string, value: number, note = '') {
      lines.push(row(label, value, note));
    }
    function totalKv(label: string, value: number) {
      lines.push(row(`>>> ${label.toUpperCase()}`, value));
    }

    // ============ HEADER ============
    lines.push(row('TIBI CONCEPT STORE'));
    lines.push(row('Accounting report'));
    blank();
    lines.push(row('Period', r.scope.label));
    lines.push(row('From',   r.scope.since.slice(0, 10)));
    lines.push(row('To',     r.scope.until.slice(0, 10)));
    lines.push(row('Generated', generated));

    // ============ TAXABLE REVENUE (top, most important) ============
    header('Tibi taxable revenue (CA imposable)');
    lines.push(row('Component', 'Amount (XOF)', 'Note'));
    kv('Consignment commissions', r.consignment.commissions_xof, 'Tibi share on brand sales');
    kv('Wholesale sales',         r.wholesale.sales_xof,          'Tibi resells purchased stock');
    kv('Tibi Editions sales',     r.own_label.sales_xof,          'Own products');
    totalKv('Total taxable revenue', r.tibi_taxable_revenue_xof);

    // ============ CONSIGNMENT ============
    header('Consignment (sales held for brands)');
    lines.push(row('Note: Tibi only earns the commission. The gross collected belongs to the brands.'));
    lines.push(row('Item', 'Amount (XOF)'));
    kv('Gross collected (NOT Tibi revenue)', r.consignment.gross_collected_xof);
    kv('Tibi commissions earned',            r.consignment.commissions_xof);
    kv('Due to brands (gross - commissions)', r.consignment.due_to_brands_xof);
    kv('Paid to brands so far',              r.consignment.paid_to_brands_xof);
    totalKv('Balance still to pay', r.consignment.balance_due_xof);

    // ============ WHOLESALE ============
    header('Wholesale (Tibi buys + resells)');
    lines.push(row('Item', 'Amount (XOF)'));
    kv('Sales',  r.wholesale.sales_xof);
    kv('COGS (cost of goods sold)', r.wholesale.cogs_xof);
    totalKv('Gross margin', r.wholesale.gross_margin_xof);

    // ============ OWN LABEL ============
    header('Tibi Editions (own label)');
    lines.push(row('Item', 'Amount (XOF)'));
    kv('Sales', r.own_label.sales_xof);
    kv('COGS (production cost)', r.own_label.cogs_xof);
    totalKv('Gross margin', r.own_label.gross_margin_xof);

    // ============ EXPENSES ============
    header('Operating expenses');
    lines.push(row('Division', 'Amount (XOF)'));
    kv('Boutique', r.expenses.boutique_xof);
    kv('Café', r.expenses.cafe_xof);
    kv('Shared overhead', r.expenses.shared_xof);
    totalKv('Total expenses', r.expenses.total_xof);

    // ============ NET PROFIT ============
    header('Net profit');
    kv('Tibi taxable revenue', r.tibi_taxable_revenue_xof);
    kv('Total operating expenses', r.expenses.total_xof);
    totalKv('Net profit', r.net_profit_xof);

    // ============ FOOTER ============
    blank();
    blank();
    lines.push(row('--- End of report ---'));
    lines.push(row('Tibi Concept Store · pos@tibiconceptstore.com · Cotonou, Bénin'));

    // BOM for Excel UTF-8 + CRLF for cross-platform compatibility
    const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tibi-accounting-${safeFilename(report.scope.label)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const buffer = await renderToBuffer(
    AccountingPdf({
      report,
      generatedOn: new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date()),
    }) as any,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tibi-accounting-${safeFilename(report.scope.label)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
