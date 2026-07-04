import { supabase } from './supabaseClient';
import { calculateSETax } from './accountingEngine';

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Math.round(cents) / 100;

/**
 * Pulls together everything a Schedule C self-filer needs for one tax year:
 * gross revenue by product line, itemized deductible expenses by category
 * (with the IRS line item each maps to), net profit, and estimated SE tax.
 */
export async function generateScheduleCData(userId, year) {
  const periodStart = `${year}-01-01`;
  const periodEnd = `${year}-12-31`;

  const [
    { data: productLines, error: plError },
    { data: categories, error: catError },
    { data: accounts, error: acctError },
    { data: transactions, error: txError },
  ] = await Promise.all([
    supabase.from('product_lines').select('id, service_line, department, product_name').eq('user_id', userId),
    supabase.from('expense_categories').select('id, category_name, tax_line_item').eq('user_id', userId),
    supabase
      .from('chart_of_accounts')
      .select('id, account_type')
      .eq('user_id', userId),
    supabase
      .from('transactions')
      .select('amount, debit_account_id, credit_account_id, product_line_id, expense_category_id, is_tax_deductible')
      .eq('user_id', userId)
      .gte('transaction_date', periodStart)
      .lte('transaction_date', periodEnd)
      .in('status', ['posted', 'reconciled']),
  ]);
  if (plError) throw plError;
  if (catError) throw catError;
  if (acctError) throw acctError;
  if (txError) throw txError;

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const productLinesById = new Map(productLines.map((p) => [p.id, p]));

  const revenueCentsByProduct = new Map();
  const deductibleCentsByCategory = new Map();
  const nonDeductibleCentsByCategory = new Map();
  let uncategorizedDeductibleCents = 0;
  let uncategorizedNonDeductibleCents = 0;
  let grossRevenueCents = 0;

  for (const tx of transactions) {
    const cents = toCents(tx.amount);

    const creditAccount = accountsById.get(tx.credit_account_id);
    if (creditAccount?.account_type === 'revenue') {
      const key = tx.product_line_id ?? '__unassigned__';
      revenueCentsByProduct.set(key, (revenueCentsByProduct.get(key) ?? 0) + cents);
      grossRevenueCents += cents;
    }

    const debitAccount = accountsById.get(tx.debit_account_id);
    if (debitAccount?.account_type === 'expense') {
      const isDeductible = tx.is_tax_deductible !== false; // null/undefined treated as deductible
      if (tx.expense_category_id) {
        const map = isDeductible ? deductibleCentsByCategory : nonDeductibleCentsByCategory;
        map.set(tx.expense_category_id, (map.get(tx.expense_category_id) ?? 0) + cents);
      } else if (isDeductible) {
        uncategorizedDeductibleCents += cents;
      } else {
        uncategorizedNonDeductibleCents += cents;
      }
    }
  }

  const revenueByProductLine = Array.from(revenueCentsByProduct.entries())
    .map(([key, cents]) => {
      const label =
        key === '__unassigned__'
          ? 'Unassigned / Overhead'
          : (() => {
              const p = productLinesById.get(key);
              return p ? [p.service_line, p.department, p.product_name].filter(Boolean).join(' › ') : 'Unknown product';
            })();
      return { label, amount: fromCents(cents) };
    })
    .sort((a, b) => b.amount - a.amount);

  const expensesByCategory = categories
    .map((c) => ({
      categoryName: c.category_name,
      taxLineItem: c.tax_line_item ?? '',
      deductibleAmount: fromCents(deductibleCentsByCategory.get(c.id) ?? 0),
      nonDeductibleAmount: fromCents(nonDeductibleCentsByCategory.get(c.id) ?? 0),
    }))
    .filter((c) => c.deductibleAmount !== 0 || c.nonDeductibleAmount !== 0);

  if (uncategorizedDeductibleCents !== 0 || uncategorizedNonDeductibleCents !== 0) {
    expensesByCategory.push({
      categoryName: 'Uncategorized',
      taxLineItem: '',
      deductibleAmount: fromCents(uncategorizedDeductibleCents),
      nonDeductibleAmount: fromCents(uncategorizedNonDeductibleCents),
    });
  }
  expensesByCategory.sort((a, b) => b.deductibleAmount - a.deductibleAmount);

  const totalDeductibleCents =
    Array.from(deductibleCentsByCategory.values()).reduce((s, v) => s + v, 0) + uncategorizedDeductibleCents;
  const totalNonDeductibleCents =
    Array.from(nonDeductibleCentsByCategory.values()).reduce((s, v) => s + v, 0) + uncategorizedNonDeductibleCents;

  const grossRevenue = fromCents(grossRevenueCents);
  const totalDeductibleExpenses = fromCents(totalDeductibleCents);
  const totalNonDeductibleExpenses = fromCents(totalNonDeductibleCents);
  const netProfit = fromCents(grossRevenueCents - totalDeductibleCents);
  const estimatedSETax = calculateSETax(netProfit);

  return {
    year,
    revenueByProductLine,
    grossRevenue,
    expensesByCategory,
    totalDeductibleExpenses,
    totalNonDeductibleExpenses,
    netProfit,
    estimatedSETax,
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a Schedule C-oriented CSV: revenue by product line, then itemized deductible expenses, then totals. */
export function buildScheduleCCsv(data) {
  const lines = [];
  lines.push(`Schedule C Export — Tax Year ${data.year}`);
  lines.push('');
  lines.push('GROSS REVENUE BY PRODUCT LINE');
  lines.push(['Product Line', 'Amount'].map(csvEscape).join(','));
  for (const r of data.revenueByProductLine) {
    lines.push([r.label, r.amount.toFixed(2)].map(csvEscape).join(','));
  }
  lines.push(['Gross Revenue (Total)', data.grossRevenue.toFixed(2)].map(csvEscape).join(','));
  lines.push('');
  lines.push('DEDUCTIBLE EXPENSES BY CATEGORY');
  lines.push(['Category', 'Schedule C Line', 'Deductible Amount', 'Non-Deductible Amount'].map(csvEscape).join(','));
  for (const e of data.expensesByCategory) {
    lines.push(
      [e.categoryName, e.taxLineItem, e.deductibleAmount.toFixed(2), e.nonDeductibleAmount.toFixed(2)]
        .map(csvEscape)
        .join(',')
    );
  }
  lines.push(
    ['Total Deductible Expenses', '', data.totalDeductibleExpenses.toFixed(2), data.totalNonDeductibleExpenses.toFixed(2)]
      .map(csvEscape)
      .join(',')
  );
  lines.push('');
  lines.push('SUMMARY');
  lines.push(['Gross Revenue', data.grossRevenue.toFixed(2)].map(csvEscape).join(','));
  lines.push(['Total Deductible Expenses', data.totalDeductibleExpenses.toFixed(2)].map(csvEscape).join(','));
  lines.push(['Net Profit', data.netProfit.toFixed(2)].map(csvEscape).join(','));
  lines.push(['Estimated Self-Employment Tax', data.estimatedSETax.toFixed(2)].map(csvEscape).join(','));

  return lines.join('\n');
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
