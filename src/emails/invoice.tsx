import { Heading, Section, Text, Hr } from '@react-email/components';
import { EmailLayout } from './_layout';

interface Props {
  invoiceNo: number;
  date: string;
  itemCount: number;
  total: number;
  customerName?: string | null;
}

const hello = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 14px' };
const heading = { fontSize: '22px', fontWeight: 500, color: '#1a1a1a', margin: '0 0 6px', letterSpacing: '-0.01em' };
const sub = { fontSize: '13px', color: '#888', margin: '0 0 24px' };
const para = { fontSize: '13px', color: '#444', lineHeight: '1.65', margin: '0 0 14px' };
const summaryBox = { background: '#f7f4ee', borderRadius: 10, padding: '18px 20px', margin: '10px 0 24px' };
const summaryLbl = { fontSize: '10px', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const summaryVal = { fontSize: '20px', fontWeight: 500, color: '#1a1a1a', margin: '4px 0 0', letterSpacing: '-0.01em' };
const soft = { fontSize: '12px', color: '#888', margin: '14px 0 0' };
const hr = { borderTop: '1px solid #e5e5e5', margin: '24px 0' };
const signOff = { fontSize: '13px', color: '#1a1a1a', margin: '18px 0 4px' };
const shop = { fontSize: '12px', color: '#888', margin: 0 };

function fmt(n: number) {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XOF`;
}

/**
 * Transactional "thank you" email sent after a sale.
 * Keeps the body warm and human — the PDF attached is the official invoice.
 */
export function InvoiceEmail({ invoiceNo, date, itemCount, total, customerName }: Props) {
  const firstName = (customerName ?? '').trim().split(/\s+/)[0] || '';
  return (
    <EmailLayout preview={`Thank you for your purchase — Invoice #${invoiceNo}`}>
      <Heading style={heading}>Thank you for your purchase</Heading>
      <Text style={sub}>Invoice #{invoiceNo} · {date}</Text>

      <Text style={hello}>{firstName ? `Hi ${firstName},` : 'Hello,'}</Text>
      <Text style={para}>
        We really appreciate you stopping by Tibi Concept Store today.
        Here’s a quick summary of your purchase — the full invoice is attached as a PDF.
      </Text>

      <Section style={summaryBox}>
        <Text style={summaryLbl}>Total</Text>
        <Text style={summaryVal}>{fmt(total)}</Text>
        <Text style={soft}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
      </Section>

      <Text style={para}>
        If anything is off or if you have questions, just reply to this email —
        we’re here to help.
      </Text>

      <Hr style={hr} />

      <Text style={signOff}>See you soon,</Text>
      <Text style={shop}>
        <strong>Tibi Concept Store</strong><br />
        pos@tibiconceptstore.com · Cotonou, Bénin
      </Text>
    </EmailLayout>
  );
}

export default InvoiceEmail;
