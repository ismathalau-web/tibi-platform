'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { formatXOF, formatDate } from '@/lib/format';
import { createExpense, deleteExpense } from './actions';

interface Expense {
  id: string;
  incurred_on: string;
  amount_xof: number;
  division: 'boutique' | 'cafe' | 'shared';
  category: string;
  payment_method: string;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
}

const divisionLabel: Record<Expense['division'], string> = {
  boutique: 'Boutique',
  cafe: 'Café',
  shared: 'Shared',
};

const categoryLabel: Record<string, string> = {
  supplies: 'Supplies',
  transport: 'Transport',
  utilities: 'Utilities',
  rent: 'Rent',
  salary: 'Salary',
  maintenance: 'Maintenance',
  other: 'Other',
};

const methodLabel: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

interface Props {
  expenses: Expense[];
  isAdmin: boolean;
  currentMonth: string;
  currentDivision: string;
  currentCategory: string;
}

export function ExpensesView({ expenses, isAdmin, currentMonth, currentDivision, currentCategory }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Totals
  const totals = useMemo(() => {
    const byDivision: Record<string, number> = { boutique: 0, cafe: 0, shared: 0 };
    let total = 0;
    for (const e of expenses) {
      total += e.amount_xof;
      byDivision[e.division] = (byDivision[e.division] ?? 0) + e.amount_xof;
    }
    return { total, byDivision };
  }, [expenses]);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams();
    params.set('month', currentMonth);
    if (key === 'division') {
      if (value !== 'all') params.set('division', value);
    } else if (currentDivision !== 'all') {
      params.set('division', currentDivision);
    }
    if (key === 'category') {
      if (value !== 'all') params.set('category', value);
    } else if (currentCategory !== 'all') {
      params.set('category', currentCategory);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setMonth(m: string) {
    const params = new URLSearchParams();
    params.set('month', m);
    if (currentDivision !== 'all') params.set('division', currentDivision);
    if (currentCategory !== 'all') params.set('category', currentCategory);
    router.push(`${pathname}?${params.toString()}`);
  }

  function exportCsv() {
    if (expenses.length === 0) return;
    const lines = ['Date,Amount (XOF),Division,Category,Payment method,Description,Recorded by'];
    for (const e of expenses) {
      const row = [
        e.incurred_on,
        e.amount_xof,
        divisionLabel[e.division],
        categoryLabel[e.category] ?? e.category,
        methodLabel[e.payment_method] ?? e.payment_method,
        JSON.stringify(e.description ?? ''),
        JSON.stringify(e.recorded_by ?? ''),
      ];
      lines.push(row.join(','));
    }
    const body = '\uFEFF' + lines.join('\r\n') + '\r\n';
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tibi-expenses-${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="tibi-page-title">Expenses</h1>
          <p className="text-[12px] text-ink-hint mt-1">
            Operating costs for {currentMonth}. Seller can add, admin can edit or delete.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setMonth(e.target.value)}
            className="tibi-input h-9 w-[150px]"
          />
          <Button variant="secondary" onClick={exportCsv} disabled={expenses.length === 0}>Export CSV</Button>
        </div>
      </header>

      {/* Add form */}
      <AddExpenseForm />

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="tibi-card">
          <div className="tibi-label mb-1">Total this month</div>
          <div className="text-[22px] font-medium tabular-nums">{formatXOF(totals.total)}</div>
          <div className="text-[11px] text-ink-hint mt-1">{expenses.length} entries</div>
        </div>
        <div className="tibi-card">
          <div className="tibi-label mb-1">Boutique</div>
          <div className="text-[22px] font-medium tabular-nums">{formatXOF(totals.byDivision.boutique ?? 0)}</div>
        </div>
        <div className="tibi-card">
          <div className="tibi-label mb-1">Café</div>
          <div className="text-[22px] font-medium tabular-nums">{formatXOF(totals.byDivision.cafe ?? 0)}</div>
        </div>
        <div className="tibi-card">
          <div className="tibi-label mb-1">Shared overhead</div>
          <div className="text-[22px] font-medium tabular-nums">{formatXOF(totals.byDivision.shared ?? 0)}</div>
        </div>
      </section>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="tibi-label">Filter:</span>
        {(['all', 'boutique', 'cafe', 'shared'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setFilter('division', d)}
            className={`text-[11px] px-3 h-7 rounded-pill border-hairline border ${currentDivision === d ? 'bg-ink text-white border-ink' : 'border-border text-ink-secondary'}`}
          >
            {d === 'all' ? 'All divisions' : divisionLabel[d as Expense['division']]}
          </button>
        ))}
      </div>

      <div className="tibi-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tibi-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Division</th>
                <th>Category</th>
                <th>Description</th>
                <th>Payment</th>
                <th>Recorded by</th>
                <th className="text-right">Amount</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center text-ink-hint py-10">No expenses yet for this filter.</td></tr>
              ) : expenses.map((e) => (
                <ExpenseRow key={e.id} e={e} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({ e, isAdmin }: { e: Expense; isAdmin: boolean }) {
  const [isPending, start] = useTransition();

  function onDelete() {
    if (!confirm(`Delete this expense (${formatXOF(e.amount_xof)} — ${categoryLabel[e.category] ?? e.category}) ?`)) return;
    start(async () => { await deleteExpense(e.id); });
  }

  return (
    <tr>
      <td className="text-ink-secondary text-[12px]">{formatDate(e.incurred_on)}</td>
      <td>
        <Badge tone={e.division === 'boutique' ? 'neutral' : e.division === 'cafe' ? 'warning' : 'success'}>
          {divisionLabel[e.division]}
        </Badge>
      </td>
      <td>{categoryLabel[e.category] ?? e.category}</td>
      <td className="text-ink-secondary">{e.description ?? '—'}</td>
      <td className="text-ink-secondary capitalize">{methodLabel[e.payment_method] ?? e.payment_method}</td>
      <td className="text-ink-secondary">{e.recorded_by ?? '—'}</td>
      <td className="text-right font-medium">{formatXOF(e.amount_xof)}</td>
      {isAdmin && (
        <td>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="text-[11px] text-ink-hint hover:text-danger-fg"
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  );
}

function AddExpenseForm() {
  const today = new Date().toISOString().slice(0, 10);
  const [incurredOn, setIncurredOn] = useState(today);
  const [amount, setAmount] = useState('');
  const [division, setDivision] = useState<Expense['division']>('shared');
  const [category, setCategory] = useState('supplies');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, start] = useTransition();

  function submit() {
    setErr(null);
    setDone(false);
    const amt = parseInt(amount || '0', 10) || 0;
    if (amt <= 0) return setErr('Amount required (> 0).');
    start(async () => {
      const res = await createExpense({
        incurred_on: incurredOn,
        amount_xof: amt,
        division,
        category: category as any,
        payment_method: paymentMethod as any,
        description: description.trim() || null,
      });
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return; }
      setAmount('');
      setDescription('');
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }

  return (
    <section className="tibi-card">
      <h2 className="tibi-section-title mb-3">Add expense</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Input label="Date" type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} />
        <Input label="Amount (XOF)" type="number" min="0" step="500" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label="Division" value={division} onChange={(e) => setDivision(e.target.value as Expense['division'])}>
          <option value="boutique">Boutique</option>
          <option value="cafe">Café</option>
          <option value="shared">Shared (overhead)</option>
        </Select>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="supplies">Supplies (bags, packaging…)</option>
          <option value="transport">Transport / Delivery</option>
          <option value="utilities">Utilities (electricity, water…)</option>
          <option value="rent">Rent</option>
          <option value="salary">Salary</option>
          <option value="maintenance">Maintenance / Repairs</option>
          <option value="other">Other</option>
        </Select>
        <Select label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="mobile_money">Mobile Money</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="other">Other</option>
        </Select>
        <div className="col-span-2 lg:col-span-3">
          <Textarea label="Description (optional)" rows={1} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <Button onClick={submit} disabled={isPending || !amount}>
          {isPending ? 'Saving…' : 'Add expense'}
        </Button>
        {done && <Badge tone="success">Added</Badge>}
        {err && <Badge tone="danger">{err}</Badge>}
      </div>
    </section>
  );
}
