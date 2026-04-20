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
    const rows = [
      ['Section', 'Metric', 'XOF'],
      ['Taxable revenue', 'Tibi CA imposable', report.tibi_taxable_revenue_xof],
      ['Consignment', 'Gross collected (not Tibi revenue)', report.consignment.gross_collected_xof],
      ['Consignment', 'Tibi commissions earned', report.consignment.commissions_xof],
      ['Consignment', 'Due to brands', report.consignment.due_to_brands_xof],
      ['Consignment', 'Paid to brands', report.consignment.paid_to_brands_xof],
      ['Consignment', 'Balance to pay', report.consignment.balance_due_xof],
      ['Wholesale', 'Sales', report.wholesale.sales_xof],
      ['Wholesale', 'COGS', report.wholesale.cogs_xof],
      ['Wholesale', 'Gross margin', report.wholesale.gross_margin_xof],
      ['Own label', 'Sales', report.own_label.sales_xof],
      ['Own label', 'COGS', report.own_label.cogs_xof],
      ['Own label', 'Gross margin', report.own_label.gross_margin_xof],
    ];
    const csv = rows.map((r) => r.map((v) => typeof v === 'string' ? JSON.stringify(v) : String(v)).join(',')).join('\n');
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
