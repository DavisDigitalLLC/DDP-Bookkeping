import { supabase } from './supabaseClient';

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Math.round(cents) / 100;

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKeyStr, delta) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive list of 'YYYY-MM' keys from startMonth through endMonth. */
export function monthRangeKeys(startMonth, endMonth) {
  const keys = [];
  let cursor = startMonth;
  // Guard against an inverted or absurd range.
  for (let i = 0; i < 600 && cursor <= endMonth; i++) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
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

function toRow({ level, label, glNumber = '', monthKeys, monthCentsMap, bold = false }) {
  const values = monthKeys.map((m) => monthCentsMap.get(m) ?? 0);
  const totalCents = values.reduce((s, v) => s + v, 0);
  return {
    level,
    label,
    glNumber,
    bold,
    monthlyTotals: Object.fromEntries(monthKeys.map((m, i) => [m, fromCents(values[i])])),
    total: fromCents(totalCents),
    average: fromCents(Math.round(totalCents / monthKeys.length)),
  };
}

/**
 * Deterministic, display-only 4-digit numbering for a Service Line ->
 * Department -> Product hierarchy. These are report labels, not real
 * posting accounts -- kept in a reserved block (base..base+199) so they
 * never collide with real GL accounts (4000s for revenue, 6000s for
 * expense).
 */
function buildProductNumbering(bySL, base) {
  const numbers = new Map(); // 'serviceLine' | 'serviceLine|department' | 'serviceLine|department|product' -> number
  let nextSlBase = base;
  for (const [serviceLine, byDept] of bySL.entries()) {
    const slBase = nextSlBase;
    numbers.set(serviceLine, slBase);

    let deptIndex = 0;
    for (const [department, products] of byDept.entries()) {
      if (department) {
        deptIndex += 1;
        const deptBase = slBase + deptIndex * 10;
        numbers.set(`${serviceLine}|${department}`, deptBase);
        products.forEach((product, i) => {
          numbers.set(`${serviceLine}|${department}|${product.id}`, deptBase + i + 1);
        });
      } else {
        products.forEach((product, i) => {
          numbers.set(`${serviceLine}|${department}|${product.id}`, slBase + i + 1);
        });
      }
    }
    nextSlBase += 100;
  }
  return numbers;
}

/**
 * Groups product_lines into Service Line -> Department -> [products], and
 * builds Service Line/Department/Product rows (with subtotals) plus an
 * Unassigned/Overhead row and a grand total, from a byProduct cents map
 * (productLineId | '__unassigned__' -> monthMap).
 */
function buildProductHierarchyRows({ byProduct, productLines, monthKeys, numberingBase, totalLabel }) {
  const rows = [];
  const totalCents = zeroMonthMap(monthKeys);

  const bySL = new Map();
  for (const p of productLines) {
    if (!bySL.has(p.service_line)) bySL.set(p.service_line, new Map());
    const byDept = bySL.get(p.service_line);
    const deptKey = p.department ?? '';
    if (!byDept.has(deptKey)) byDept.set(deptKey, []);
    byDept.get(deptKey).push(p);
  }
  const numbers = buildProductNumbering(bySL, numberingBase);

  for (const [serviceLine, byDept] of bySL.entries()) {
    const slCents = zeroMonthMap(monthKeys);
    const slRows = [];

    for (const [department, products] of byDept.entries()) {
      const deptCents = zeroMonthMap(monthKeys);
      const deptRows = [];

      for (const product of products) {
        const productCents = byProduct.get(product.id) ?? zeroMonthMap(monthKeys);
        deptRows.push(
          toRow({
            level: 2,
            label: product.product_name,
            glNumber: numbers.get(`${serviceLine}|${department}|${product.id}`) ?? '',
            monthKeys,
            monthCentsMap: productCents,
          })
        );
        addInto(deptCents, productCents);
      }

      addInto(slCents, deptCents);
      if (department) {
        slRows.push(
          toRow({
            level: 1,
            label: department,
            glNumber: numbers.get(`${serviceLine}|${department}`) ?? '',
            monthKeys,
            monthCentsMap: deptCents,
            bold: true,
          })
        );
      }
      slRows.push(...deptRows);
    }

    rows.push(
      toRow({
        level: 0,
        label: serviceLine,
        glNumber: numbers.get(serviceLine) ?? '',
        monthKeys,
        monthCentsMap: slCents,
        bold: true,
      })
    );
    rows.push(...slRows);
    addInto(totalCents, slCents);
  }

  const unassigned = byProduct.get('__unassigned__');
  if (unassigned && [...unassigned.values()].some((v) => v !== 0)) {
    rows.push(toRow({ level: 0, label: 'Unassigned / Overhead', monthKeys, monthCentsMap: unassigned, bold: true }));
    addInto(totalCents, unassigned);
  }

  const totalRow = toRow({ level: 0, label: totalLabel, monthKeys, monthCentsMap: totalCents, bold: true });
  rows.push(totalRow);

  return { rows, totalRow };
}

/**
 * Hierarchical trend report over an explicit [startMonth, endMonth] range
 * (both 'YYYY-MM', inclusive):
 *  - Revenue: Service Line -> Department -> Product, each with subtotals,
 *    followed by a Total Revenue row.
 *  - Expenses by Product Line: same Service Line -> Department -> Product
 *    breakdown, but for expense-side activity -- cost-center view, mirrors
 *    the Revenue section.
 *  - Operating Expenses: one row per GL account, broken into vendor
 *    sub-rows, followed by a Total Operating Expenses row.
 *  - Fixed Expenses: one row per GL account (Taxes, Payroll, ...), no
 *    vendor breakout, followed by a Total Fixed Expenses row.
 *  - Summary: Total Revenue, Total Operating Expenses, Total Fixed
 *    Expenses, Net Income.
 *
 * All rows share the same shape: { level, label, glNumber, bold,
 * monthlyTotals, total, average }, so the UI can render every section as a
 * flat, indented table.
 */
export async function generateHierarchicalTrends(userId, { startMonth, endMonth }) {
  const monthKeys = monthRangeKeys(startMonth, endMonth);
  const windowStart = `${startMonth}-01`;
  const windowEnd = `${shiftMonthKey(endMonth, 1)}-01`; // exclusive upper bound

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
        .select(
          'amount, transaction_date, description, debit_account_id, credit_account_id, product_line_id, vendor_id, vendor:vendors(vendor_name)'
        )
        .eq('user_id', userId)
        .gte('transaction_date', windowStart)
        .lt('transaction_date', windowEnd)
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
  const expenseByProduct = new Map(); // productLineId | '__unassigned__' -> monthMap(cents)
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
      const productKey = tx.product_line_id ?? '__unassigned__';
      const productMonthMap = getBucket(expenseByProduct, productKey, () => zeroMonthMap(monthKeys));
      productMonthMap.set(mKey, productMonthMap.get(mKey) + cents);

      const vendorMap = getBucket(expenseByAccountVendor, debitAccount.id, () => new Map());
      // Prefer the vendor entity (rename-safe); fall back to the raw
      // description for older rows posted before vendors existed.
      const vendorKey = tx.vendor?.vendor_name?.trim() || tx.description?.trim() || '(no description)';
      const monthMap = getBucket(vendorMap, vendorKey, () => zeroMonthMap(monthKeys));
      monthMap.set(mKey, monthMap.get(mKey) + cents);
    }
  }

  // ---------------------------------------------------------------------
  // Revenue and Expenses-by-product-line: both Service Line -> Department
  // -> Product, built the same way.
  // ---------------------------------------------------------------------
  const { rows: revenueRows, totalRow: totalRevenueRow } = buildProductHierarchyRows({
    byProduct: revenueByProduct,
    productLines,
    monthKeys,
    numberingBase: 4100,
    totalLabel: 'Total Revenue',
  });

  const { rows: expenseByProductRows } = buildProductHierarchyRows({
    byProduct: expenseByProduct,
    productLines,
    monthKeys,
    numberingBase: 6100,
    totalLabel: 'Total Expenses',
  });

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
      vendorRows.push(toRow({ level: 1, label: vendor, monthKeys, monthCentsMap: monthMap }));
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
      })
    );
    addInto(totalFixedCents, accountCents);
  }
  const totalFixedRow = toRow({
    level: 0,
    label: 'Total Fixed Expenses',
    monthKeys,
    monthCentsMap: totalFixedCents,
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
    toRow({ level: 0, label: 'Net Income', monthKeys, monthCentsMap: netIncomeCents, bold: true }),
  ];

  return { months: monthKeys, revenueRows, expenseByProductRows, operatingRows, fixedRows, summaryRows };
}
