import { supabase } from './supabaseClient';

// All currency math is done in integer cents to avoid floating-point drift
// (see spec Section 11: "Float precision in currency calculations").
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Math.round(cents) / 100;

const SE_TAX_RATE = 0.153; // 15.3%
const SE_TAX_NET_EARNINGS_FACTOR = 0.9235; // 92.35%

async function validateAccountsActive(userId, accountIds) {
  const { data: accounts, error } = await supabase
    .from('chart_of_accounts')
    .select('id, is_active')
    .eq('user_id', userId)
    .in('id', accountIds);
  if (error) throw error;
  if (!accounts || accounts.length !== accountIds.length) {
    throw new Error('One or both accounts were not found');
  }
  if (accounts.some((a) => !a.is_active)) {
    throw new Error('Cannot post to an inactive account');
  }
}

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
  vendorId = null,
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

  await validateAccountsActive(userId, [debitAccountId, creditAccountId]);

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
      vendor_id: vendorId,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Split one cost evenly across several product lines. Posts N independent
 * GL transactions (one per product line) so every existing report --
 * P&L, Trends, Balance Sheet -- keeps working unchanged, since they all key
 * off a single product_line_id per transaction row.
 *
 * Splits cents-accurately: if the total doesn't divide evenly, the leading
 * splits absorb one extra cent each so the sum always equals the original
 * amount exactly (e.g. $100 / 3 -> $33.34, $33.33, $33.33).
 */
export async function postSplitTransaction({
  userId,
  debitAccountId,
  creditAccountId,
  amount,
  description = '',
  transactionDate = new Date().toISOString().slice(0, 10),
  productLineIds,
  productLineLabelsById = {},
  receiptId = null,
  expenseCategoryId = null,
  isTaxDeductible = null,
  vendorId = null,
  status = 'posted',
}) {
  if (!userId) throw new Error('postSplitTransaction: userId is required');
  if (!debitAccountId || !creditAccountId) {
    throw new Error('postSplitTransaction: debitAccountId and creditAccountId are required');
  }
  if (debitAccountId === creditAccountId) {
    throw new Error('postSplitTransaction: debit and credit accounts must differ');
  }
  if (!Array.isArray(productLineIds) || productLineIds.length < 2) {
    throw new Error('postSplitTransaction: select at least two product lines to split across');
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('postSplitTransaction: amount must be a positive number');
  }

  await validateAccountsActive(userId, [debitAccountId, creditAccountId]);

  const n = productLineIds.length;
  const totalCents = toCents(numericAmount);
  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;

  const rows = productLineIds.map((productLineId, i) => {
    const cents = baseCents + (i < remainder ? 1 : 0);
    const label = productLineLabelsById[productLineId];
    return {
      user_id: userId,
      product_line_id: productLineId,
      transaction_date: transactionDate,
      posted_date: new Date().toISOString().slice(0, 10),
      description: label ? `${description} (split: ${label})` : description,
      receipt_id: receiptId,
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      amount: fromCents(cents),
      expense_category_id: expenseCategoryId,
      is_tax_deductible: isTaxDeductible,
      vendor_id: vendorId,
      status,
    };
  });

  const { data, error } = await supabase.from('transactions').insert(rows).select();
  if (error) throw error;
  return data;
}

/**
 * Post one payment as several independent GL transactions, each with its
 * own account, amount, product line, and category -- for a single invoice
 * that covers genuinely different expense (or revenue) categories, e.g. an
 * LLC formation invoice covering both filing fees and a domain purchase.
 * Unlike postSplitTransaction (one account, evenly divided across product
 * lines), each line item here is independent and the amounts don't have
 * to be equal or even sum to a predetermined total -- the total *is* the
 * sum of the lines.
 */
export async function postItemizedTransaction({
  userId,
  moneyAccountId,
  entryType, // 'expense' | 'income' -- which side of each line the money account sits on
  transactionDate = new Date().toISOString().slice(0, 10),
  description = '',
  vendorId = null,
  receiptId = null,
  lineItems, // [{ amount, accountId, productLineId, expenseCategoryId, isTaxDeductible }]
  status = 'posted',
}) {
  if (!userId) throw new Error('postItemizedTransaction: userId is required');
  if (!moneyAccountId) throw new Error('postItemizedTransaction: moneyAccountId is required');
  if (!Array.isArray(lineItems) || lineItems.length < 2) {
    throw new Error('postItemizedTransaction: at least two line items are required');
  }
  for (const line of lineItems) {
    const numericAmount = Number(line.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('postItemizedTransaction: every line item needs a positive amount');
    }
    if (!line.accountId) {
      throw new Error('postItemizedTransaction: every line item needs an account');
    }
  }

  const accountIds = [...new Set([moneyAccountId, ...lineItems.map((l) => l.accountId)])];
  await validateAccountsActive(userId, accountIds);

  const rows = lineItems.map((line) => {
    const debitAccountId = entryType === 'expense' ? line.accountId : moneyAccountId;
    const creditAccountId = entryType === 'expense' ? moneyAccountId : line.accountId;
    return {
      user_id: userId,
      product_line_id: line.productLineId || null,
      transaction_date: transactionDate,
      posted_date: new Date().toISOString().slice(0, 10),
      description,
      receipt_id: receiptId,
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      amount: fromCents(toCents(Number(line.amount))),
      expense_category_id: entryType === 'expense' ? line.expenseCategoryId || null : null,
      is_tax_deductible: entryType === 'expense' ? (line.isTaxDeductible ?? null) : null,
      vendor_id: vendorId,
      status,
    };
  });

  const { data, error } = await supabase.from('transactions').insert(rows).select();
  if (error) throw error;
  return data;
}

/**
 * Edit an existing GL transaction in place. Re-validates both accounts
 * (they may have changed) the same way postTransaction does.
 */
export async function updateTransaction({
  userId,
  transactionId,
  debitAccountId,
  creditAccountId,
  amount,
  description = '',
  transactionDate,
  productLineId = null,
  expenseCategoryId = null,
  isTaxDeductible = null,
  vendorId = null,
}) {
  if (!userId) throw new Error('updateTransaction: userId is required');
  if (!transactionId) throw new Error('updateTransaction: transactionId is required');
  if (!debitAccountId || !creditAccountId) {
    throw new Error('updateTransaction: debitAccountId and creditAccountId are required');
  }
  if (debitAccountId === creditAccountId) {
    throw new Error('updateTransaction: debit and credit accounts must differ');
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('updateTransaction: amount must be a positive number');
  }

  await validateAccountsActive(userId, [debitAccountId, creditAccountId]);

  const { data, error } = await supabase
    .from('transactions')
    .update({
      product_line_id: productLineId,
      transaction_date: transactionDate,
      description,
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      amount: fromCents(toCents(numericAmount)),
      expense_category_id: expenseCategoryId,
      is_tax_deductible: isTaxDeductible,
      vendor_id: vendorId,
    })
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction({ userId, transactionId }) {
  if (!userId) throw new Error('deleteTransaction: userId is required');
  if (!transactionId) throw new Error('deleteTransaction: transactionId is required');

  const { error } = await supabase.from('transactions').delete().eq('id', transactionId).eq('user_id', userId);
  if (error) throw error;
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

function dayBefore(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Cash-basis cash flow statement for [periodStart, periodEnd] (inclusive).
 * "Cash" is whichever GL accounts are linked from bank_accounts.gl_account_id
 * (falls back to account 1000 "Cash in Bank" if no bank accounts are linked
 * yet). Every transaction touching a cash account is classified by the
 * *other* account it touches:
 *   - revenue/expense counterpart -> Operating activities
 *   - asset counterpart           -> Investing activities
 *   - liability/equity counterpart -> Financing activities
 * Transfers between two cash accounts net to zero (no external cash effect).
 */
export async function generateCashFlow(userId, periodStart, periodEnd) {
  const [{ data: bankAccounts, error: bankError }, { data: accounts, error: acctError }] = await Promise.all([
    supabase.from('bank_accounts').select('gl_account_id').eq('user_id', userId).eq('is_active', true),
    supabase
      .from('chart_of_accounts')
      .select('id, account_number, account_name, account_type')
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);
  if (bankError) throw bankError;
  if (acctError) throw acctError;

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  let cashAccountIds = [...new Set(bankAccounts.map((b) => b.gl_account_id).filter(Boolean))];
  if (cashAccountIds.length === 0) {
    const fallback = accounts.find((a) => a.account_number === '1000');
    if (fallback) cashAccountIds = [fallback.id];
  }
  const cashAccountIdSet = new Set(cashAccountIds);

  const [beginningResults, endingResults] = await Promise.all([
    Promise.all(cashAccountIds.map((id) => getAccountBalance(id, dayBefore(periodStart)))),
    Promise.all(cashAccountIds.map((id) => getAccountBalance(id, periodEnd))),
  ]);
  const beginningCash = beginningResults.reduce((s, v) => s + v, 0);
  const endingCash = endingResults.reduce((s, v) => s + v, 0);

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, transaction_date, debit_account_id, credit_account_id')
    .eq('user_id', userId)
    .gte('transaction_date', periodStart)
    .lte('transaction_date', periodEnd)
    .in('status', ['posted', 'reconciled']);
  if (txError) throw txError;

  const CATEGORY_BY_TYPE = { revenue: 'operating', expense: 'operating', asset: 'investing', liability: 'financing', equity: 'financing' };
  const buckets = {
    operating: new Map(),
    investing: new Map(),
    financing: new Map(),
  };

  for (const tx of transactions) {
    const cents = toCents(tx.amount);
    const debitIsCash = cashAccountIdSet.has(tx.debit_account_id);
    const creditIsCash = cashAccountIdSet.has(tx.credit_account_id);
    if (debitIsCash === creditIsCash) continue; // both cash (transfer) or neither -- no external effect

    const counterpartyId = debitIsCash ? tx.credit_account_id : tx.debit_account_id;
    const counterparty = accountsById.get(counterpartyId);
    if (!counterparty) continue;

    const category = CATEGORY_BY_TYPE[counterparty.account_type];
    if (!category) continue;

    const signedCents = debitIsCash ? cents : -cents; // cash in vs. cash out
    const bucket = buckets[category];
    bucket.set(counterpartyId, (bucket.get(counterpartyId) ?? 0) + signedCents);
  }

  const buildLineItems = (bucket) =>
    Array.from(bucket.entries())
      .map(([accountId, cents]) => ({
        accountName: accountsById.get(accountId)?.account_name ?? 'Unknown account',
        amount: fromCents(cents),
      }))
      .filter((item) => item.amount !== 0)
      .sort((a, b) => b.amount - a.amount);

  const totalFor = (bucket) => fromCents(Array.from(bucket.values()).reduce((s, v) => s + v, 0));

  const operating = { lineItems: buildLineItems(buckets.operating), total: totalFor(buckets.operating) };
  const investing = { lineItems: buildLineItems(buckets.investing), total: totalFor(buckets.investing) };
  const financing = { lineItems: buildLineItems(buckets.financing), total: totalFor(buckets.financing) };

  return {
    periodStart,
    periodEnd,
    beginningCash: fromCents(toCents(beginningCash)),
    endingCash: fromCents(toCents(endingCash)),
    netChange: fromCents(toCents(endingCash) - toCents(beginningCash)),
    operating,
    investing,
    financing,
  };
}
