import { supabase } from './supabaseClient';

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Math.round(cents) / 100;

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

function lastNMonthKeys(n, endDate = new Date()) {
  const keys = [];
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function zeroMonthMap(monthKeys) {
  return new Map(monthKeys.map((m) => [m, 0]));
}

function addInto(target, source) {
  for (const [k, v] of source.entries()) target.set(k, (target.get(k) ?? 0) + v);
  return target;
}

function toRow({ level, label, glNumber = '', monthKeys, monthCentsMap, months, bold = false }) {
  const values = monthKeys.map((m) => monthCentsMap.get(m) ?? 0);
  const totalCents = values.reduce((s, v) => s + v, 0);
  return {
    level,
    label,
    glNumber,
    bold,
    monthlyTotals: Object.fromEntries(monthKeys.map((m, i) => [m, fromCents(values[i])])),
    total: fromCents(totalCents),
    average: fromCents(Math.round(totalCents / months)),
  };
}

/**
 * Hierarchical trend report:
 *  - Revenue: Service Line -> Department -> Product, each with subtotals,
 *    followed by a Total Revenue row.
 *  - Operating Expenses: one row per GL account, broken into vendor
 *    sub-rows (grouped by transaction description), followed by a Total
 *    Operating Expenses row.
 *  - Fixed Expenses: one row per GL account (Taxes, Payroll, ...), no
 *    vendor breakout, followed by a Total Fixed Expenses row.
 *  - Summary: Total Revenue, Total Operating Expenses, Total Fixed
 *    Expenses, Net Income.
 *
 * All rows share the same shape: { level, label, glNumber, bold,
 * monthlyTotals, total, average }, so the UI can render every section as a
 * flat, indented table.
 */
export async function generateHierarchicalTrends(userId, { months = 12 } = {}) {
  const monthKeys = lastNMonthKeys(months);
  const windowStart = `${monthKeys[0]}-01`;

  const [{ data: productLines, error: plError }, { data: accounts, error: acctError }, { data: transactions, error: txError }] =
    await Promise.all([
      supabase
        .from('product_lines')
        .select('id, service_line, department, product_name')
        .eq('user_id', userId)
        .order('service_line')
        .order('department')
        .order('product_name'),
      supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type, account_class')
        .eq('user_id', userId)
        .in('account_type', ['revenue', 'expense'])
        .eq('is_active', true)
        .order('account_number'),
      supabase
        .from('transactions')
        .select('amount, transaction_date, description, debit_account_id, credit_account_id, product_line_id')
        .eq('user_id', userId)
        .gte('transaction_date', windowStart)
        .in('status', ['posted', 'reconciled']),
    ]);
  if (plError) throw plError;
  if (acctError) throw acctError;
  if (txError) throw txError;

  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  // ---------------------------------------------------------------------
  // Bucket transaction activity
  // ---------------------------------------------------------------------
  const revenueByProduct = new Map(); // productLineId | '__unassigned__' -> monthMap(cents)
  const expenseByAccountVendor = new Map(); // accountId -> vendor -> monthMap(cents)

  const getBucket = (map, key, factory) => {
    if (!map.has(key)) map.set(key, factory());
    return map.get(key);
  };

  for (const tx of transactions) {
    const mKey = monthKey(tx.transaction_date);
    if (!monthKeys.includes(mKey)) continue;
    const cents = toCents(tx.amount);

    const creditAccount = accountsById.get(tx.credit_account_id);
    if (creditAccount?.account_type === 'revenue') {
      const key = tx.product_line_id ?? '__unassigned__';
      const monthMap = getBucket(revenueByProduct, key, () => zeroMonthMap(monthKeys));
      monthMap.set(mKey, monthMap.get(mKey) + cents);
    }

    const debitAccount = accountsById.get(tx.debit_account_id);
    if (debitAccount?.account_type === 'expense') {
      const vendorMap = getBucket(expenseByAccountVendor, debitAccount.id, () => new Map());
      const vendorKey = tx.description?.trim() || '(no description)';
      const monthMap = getBucket(vendorMap, vendorKey, () => zeroMonthMap(monthKeys));
      monthMap.set(mKey, monthMap.get(mKey) + cents);
    }
  }

  // ---------------------------------------------------------------------
  // Revenue: Service Line -> Department -> Product
  // ---------------------------------------------------------------------
  const revenueRows = [];
  const totalRevenueCents = zeroMonthMap(monthKeys);

  const bySL = new Map();
  for (const p of productLines) {
    if (!bySL.has(p.service_line)) bySL.set(p.service_line, new Map());
    const byDept = bySL.get(p.service_line);
    const deptKey = p.department ?? '';
    if (!byDept.has(deptKey)) byDept.set(deptKey, []);
    byDept.get(deptKey).push(p);
  }

  for (const [serviceLine, byDept] of bySL.entries()) {
    const slCents = zeroMonthMap(monthKeys);
    const slRows = [];

    for (const [department, products] of byDept.entries()) {
      const deptCents = zeroMonthMap(monthKeys);
      const deptRows = [];

      for (const product of products) {
        const productCents = revenueByProduct.get(product.id) ?? zeroMonthMap(monthKeys);
        deptRows.push(
          toRow({ level: 2, label: product.product_name, monthKeys, monthCentsMap: productCents, months })
        );
        addInto(deptCents, productCents);
      }

      addInto(slCents, deptCents);
      if (department) {
        slRows.push(toRow({ level: 1, label: department, monthKeys, monthCentsMap: deptCents, months, bold: true }));
      }
      slRows.push(...deptRows);
    }

    revenueRows.push(toRow({ level: 0, label: serviceLine, monthKeys, monthCentsMap: slCents, months, bold: true }));
    revenueRows.push(...slRows);
    addInto(totalRevenueCents, slCents);
  }

  const unassignedRevenue = revenueByProduct.get('__unassigned__');
  if (unassignedRevenue && [...unassignedRevenue.values()].some((v) => v !== 0)) {
    revenueRows.push(
      toRow({ level: 0, label: 'Unassigned / Overhead', monthKeys, monthCentsMap: unassignedRevenue, months, bold: true })
    );
    addInto(totalRevenueCents, unassignedRevenue);
  }

  const totalRevenueRow = toRow({ level: 0, label: 'Total Revenue', monthKeys, monthCentsMap: totalRevenueCents, months, bold: true });
  revenueRows.push(totalRevenueRow);

  // ---------------------------------------------------------------------
  // Expenses: Operating (with vendor breakout) and Fixed (flat)
  // ---------------------------------------------------------------------
  const expenseAccounts = accounts.filter((a) => a.account_type === 'expense');
  const operatingAccounts = expenseAccounts.filter(
    (a) => a.account_class === 'operating_expense' || a.account_class === 'cost_of_goods_sold'
  );
  const fixedAccounts = expenseAccounts.filter((a) => a.account_class === 'fixed_expense');

  const operatingRows = [];
  const totalOperatingCents = zeroMonthMap(monthKeys);

  for (const account of operatingAccounts) {
    const vendorMap = expenseByAccountVendor.get(account.id) ?? new Map();
    const accountCents = zeroMonthMap(monthKeys);
    const vendorRows = [];

    for (const [vendor, monthMap] of vendorMap.entries()) {
      vendorRows.push(toRow({ level: 1, label: vendor, monthKeys, monthCentsMap: monthMap, months }));
      addInto(accountCents, monthMap);
    }
    vendorRows.sort((a, b) => b.total - a.total);

    operatingRows.push(
      toRow({
        level: 0,
        label: account.account_name,
        glNumber: account.account_number,
        monthKeys,
        monthCentsMap: accountCents,
        months,
        bold: true,
      })
    );
    operatingRows.push(...vendorRows);
    addInto(totalOperatingCents, accountCents);
  }
  const totalOperatingRow = toRow({
    level: 0,
    label: 'Total Operating Expenses',
    monthKeys,
    monthCentsMap: totalOperatingCents,
    months,
    bold: true,
  });
  operatingRows.push(totalOperatingRow);

  const fixedRows = [];
  const totalFixedCents = zeroMonthMap(monthKeys);
  for (const account of fixedAccounts) {
    const vendorMap = expenseByAccountVendor.get(account.id) ?? new Map();
    const accountCents = zeroMonthMap(monthKeys);
    for (const monthMap of vendorMap.values()) addInto(accountCents, monthMap);

    fixedRows.push(
      toRow({
        level: 0,
        label: account.account_name,
        glNumber: account.account_number,
        monthKeys,
        monthCentsMap: accountCents,
        months,
      })
    );
    addInto(totalFixedCents, accountCents);
  }
  const totalFixedRow = toRow({
    level: 0,
    label: 'Total Fixed Expenses',
    monthKeys,
    monthCentsMap: totalFixedCents,
    months,
    bold: true,
  });
  fixedRows.push(totalFixedRow);

  // ---------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------
  const netIncomeCents = zeroMonthMap(monthKeys);
  for (const m of monthKeys) {
    netIncomeCents.set(
      m,
      toCents(totalRevenueRow.monthlyTotals[m]) - toCents(totalOperatingRow.monthlyTotals[m]) - toCents(totalFixedRow.monthlyTotals[m])
    );
  }

  const summaryRows = [
    { ...totalRevenueRow, label: 'Total Revenue' },
    { ...totalOperatingRow, label: 'Total Operating Expenses' },
    { ...totalFixedRow, label: 'Total Fixed Expenses' },
    toRow({ level: 0, label: 'Net Income', monthKeys, monthCentsMap: netIncomeCents, months, bold: true }),
  ];

  return { months: monthKeys, revenueRows, operatingRows, fixedRows, summaryRows };
}
