import { supabase } from './supabaseClient';

// All currency math is done in integer cents to avoid floating-point drift
// (see spec Section 11: "Float precision in currency calculations").
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Math.round(cents) / 100;

const SE_TAX_RATE = 0.153; // 15.3%
const SE_TAX_NET_EARNINGS_FACTOR = 0.9235; // 92.35%

/**
 * Post a double-entry GL transaction. Debits and credits are always equal
 * because there is a single `amount` shared by both accounts.
 */
export async function postTransaction({
  userId,
  debitAccountId,
  creditAccountId,
  amount,
  description = '',
  transactionDate = new Date().toISOString().slice(0, 10),
  productLineId = null,
  bookId = null,
  receiptId = null,
  expenseCategoryId = null,
  isTaxDeductible = null,
  status = 'posted',
}) {
  if (!userId) throw new Error('postTransaction: userId is required');
  if (!debitAccountId || !creditAccountId) {
    throw new Error('postTransaction: debitAccountId and creditAccountId are required');
  }
  if (debitAccountId === creditAccountId) {
    throw new Error('postTransaction: debit and credit accounts must differ');
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('postTransaction: amount must be a positive number');
  }

  const { data: accounts, error: acctError } = await supabase
    .from('chart_of_accounts')
    .select('id, is_active')
    .eq('user_id', userId)
    .in('id', [debitAccountId, creditAccountId]);

  if (acctError) throw acctError;
  if (!accounts || accounts.length !== 2) {
    throw new Error('postTransaction: one or both accounts were not found');
  }
  if (accounts.some((a) => !a.is_active)) {
    throw new Error('postTransaction: cannot post to an inactive account');
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      product_line_id: productLineId,
      book_id: bookId,
      transaction_date: transactionDate,
      posted_date: new Date().toISOString().slice(0, 10),
      description,
      receipt_id: receiptId,
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      amount: fromCents(toCents(numericAmount)),
      expense_category_id: expenseCategoryId,
      is_tax_deductible: isTaxDeductible,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Balance = sum(debits to this account) - sum(credits to this account),
 * flipped in sign for credit-normal accounts (liability/equity/revenue).
 */
export async function getAccountBalance(accountId, asOfDate = null) {
  const { data: account, error: acctError } = await supabase
    .from('chart_of_accounts')
    .select('id, normal_balance')
    .eq('id', accountId)
    .single();
  if (acctError) throw acctError;

  let debitQuery = supabase
    .from('transactions')
    .select('amount')
    .eq('debit_account_id', accountId)
    .in('status', ['posted', 'reconciled']);
  let creditQuery = supabase
    .from('transactions')
    .select('amount')
    .eq('credit_account_id', accountId)
    .in('status', ['posted', 'reconciled']);

  if (asOfDate) {
    debitQuery = debitQuery.lte('transaction_date', asOfDate);
    creditQuery = creditQuery.lte('transaction_date', asOfDate);
  }

  const [{ data: debits, error: dErr }, { data: credits, error: cErr }] = await Promise.all([
    debitQuery,
    creditQuery,
  ]);
  if (dErr) throw dErr;
  if (cErr) throw cErr;

  const debitCents = debits.reduce((sum, t) => sum + toCents(t.amount), 0);
  const creditCents = credits.reduce((sum, t) => sum + toCents(t.amount), 0);

  const net = account.normal_balance === 'debit' ? debitCents - creditCents : creditCents - debitCents;
  return fromCents(net);
}

export function calculateSETax(netIncome) {
  if (!Number.isFinite(netIncome) || netIncome <= 0) return 0;
  const netEarningsCents = toCents(netIncome) * SE_TAX_NET_EARNINGS_FACTOR;
  return fromCents(Math.round(netEarningsCents * SE_TAX_RATE));
}

export function generateQuarterlyTaxEstimate(annualNetIncome) {
  const annualTax = calculateSETax(annualNetIncome);
  return fromCents(Math.round(toCents(annualTax) / 4));
}

function emptyProductBucket() {
  return { revenueCents: 0, deductibleCents: 0, nonDeductibleCents: 0 };
}

/**
 * Hierarchical P&L: Service Line -> Department -> Product, plus grand totals
 * and SE tax estimates. Mirrors the structure in spec Section 3.
 */
export async function generateProfitAndLoss(
  userId,
  periodStart,
  periodEnd,
  { serviceLineFilter = null, departmentFilter = null, productLineId = null } = {}
) {
  const { data: productLines, error: plError } = await supabase
    .from('product_lines')
    .select('id, service_line, department, product_name')
    .eq('user_id', userId);
  if (plError) throw plError;

  let txQuery = supabase
    .from('transactions')
    .select(
      `id, amount, product_line_id, is_tax_deductible,
       debit_account:chart_of_accounts!transactions_debit_account_id_fkey(account_type),
       credit_account:chart_of_accounts!transactions_credit_account_id_fkey(account_type)`
    )
    .eq('user_id', userId)
    .gte('transaction_date', periodStart)
    .lte('transaction_date', periodEnd)
    .in('status', ['posted', 'reconciled']);

  if (productLineId) txQuery = txQuery.eq('product_line_id', productLineId);

  const { data: transactions, error: txError } = await txQuery;
  if (txError) throw txError;

  const productLinesById = new Map(productLines.map((p) => [p.id, p]));
  const buckets = new Map(); // product_line_id (or '__unassigned__') -> bucket

  const getBucket = (key) => {
    if (!buckets.has(key)) buckets.set(key, emptyProductBucket());
    return buckets.get(key);
  };

  for (const tx of transactions) {
    const key = tx.product_line_id ?? '__unassigned__';
    const bucket = getBucket(key);
    const cents = toCents(tx.amount);

    if (tx.credit_account?.account_type === 'revenue') {
      bucket.revenueCents += cents;
    }
    if (tx.debit_account?.account_type === 'expense') {
      if (tx.is_tax_deductible) bucket.deductibleCents += cents;
      else bucket.nonDeductibleCents += cents;
    }
  }

  // Build Service Line -> Department -> Product tree
  const tree = new Map();
  let totalRevenueCents = 0;
  let totalDeductibleCents = 0;
  let totalNonDeductibleCents = 0;

  for (const [key, bucket] of buckets.entries()) {
    const product = key === '__unassigned__' ? null : productLinesById.get(key);
    const serviceLine = product?.service_line ?? 'Unassigned';
    const department = product?.department ?? '(none)';
    const productName = product?.product_name ?? 'Unassigned / Overhead';

    if (serviceLineFilter && serviceLine !== serviceLineFilter) continue;
    if (departmentFilter && department !== departmentFilter) continue;

    if (!tree.has(serviceLine)) tree.set(serviceLine, { departments: new Map(), subtotalCents: 0 });
    const slNode = tree.get(serviceLine);

    if (!slNode.departments.has(department)) {
      slNode.departments.set(department, { products: [], subtotalCents: 0 });
    }
    const deptNode = slNode.departments.get(department);

    const netCents = bucket.revenueCents - bucket.deductibleCents - bucket.nonDeductibleCents;
    deptNode.products.push({
      productLineId: key === '__unassigned__' ? null : key,
      productName,
      revenue: fromCents(bucket.revenueCents),
      deductibleExpenses: fromCents(bucket.deductibleCents),
      nonDeductibleExpenses: fromCents(bucket.nonDeductibleCents),
      netIncome: fromCents(netCents),
    });
    deptNode.subtotalCents += netCents;
    slNode.subtotalCents += netCents;

    totalRevenueCents += bucket.revenueCents;
    totalDeductibleCents += bucket.deductibleCents;
    totalNonDeductibleCents += bucket.nonDeductibleCents;
  }

  const serviceLines = Array.from(tree.entries()).map(([serviceLine, slNode]) => ({
    serviceLine,
    subtotal: fromCents(slNode.subtotalCents),
    departments: Array.from(slNode.departments.entries()).map(([department, deptNode]) => ({
      department,
      subtotal: fromCents(deptNode.subtotalCents),
      products: deptNode.products,
    })),
  }));

  const totalExpensesCents = totalDeductibleCents + totalNonDeductibleCents;
  const netIncome = fromCents(totalRevenueCents - totalExpensesCents);
  const netTaxableIncome = fromCents(totalRevenueCents - totalDeductibleCents);
  const estimatedSETax = calculateSETax(netTaxableIncome);

  return {
    periodStart,
    periodEnd,
    serviceLines,
    totals: {
      grossRevenue: fromCents(totalRevenueCents),
      deductibleExpenses: fromCents(totalDeductibleCents),
      nonDeductibleExpenses: fromCents(totalNonDeductibleCents),
      totalExpenses: fromCents(totalExpensesCents),
      netIncome,
      netTaxableIncome,
      estimatedSETax,
      quarterlyEstimate: generateQuarterlyTaxEstimate(netTaxableIncome),
    },
  };
}

/**
 * Balance Sheet as of a date: Assets = Liabilities + Equity, where Equity
 * includes retained earnings from prior periods plus current-period P&L.
 */
export async function generateBalanceSheet(userId, asOfDate = new Date().toISOString().slice(0, 10)) {
  const { data: accounts, error } = await supabase
    .from('chart_of_accounts')
    .select('id, account_number, account_name, account_type, normal_balance')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw error;

  const byType = { asset: [], liability: [], equity: [] };
  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;
  let totalEquityCents = 0;

  for (const account of accounts) {
    if (!byType[account.account_type]) continue;
    const balance = await getAccountBalance(account.id, asOfDate);
    const cents = toCents(balance);
    byType[account.account_type].push({ ...account, balance });

    if (account.account_type === 'asset') totalAssetsCents += cents;
    if (account.account_type === 'liability') totalLiabilitiesCents += cents;
    if (account.account_type === 'equity') totalEquityCents += cents;
  }

  // Current-period net income (all revenue/expense activity to date) rolls
  // into equity as retained earnings until formally closed.
  const pl = await generateProfitAndLoss(userId, '1900-01-01', asOfDate);
  const netIncomeCents = toCents(pl.totals.netIncome);

  return {
    asOfDate,
    assets: byType.asset,
    liabilities: byType.liability,
    equity: byType.equity,
    totals: {
      totalAssets: fromCents(totalAssetsCents),
      totalLiabilities: fromCents(totalLiabilitiesCents),
      totalEquity: fromCents(totalEquityCents + netIncomeCents),
      currentPeriodNetIncome: fromCents(netIncomeCents),
      balanced: totalAssetsCents === totalLiabilitiesCents + totalEquityCents + netIncomeCents,
    },
  };
}
