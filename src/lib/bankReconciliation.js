import { supabase } from './supabaseClient';

/**
 * Parse a simple CSV with a header row and columns date, description, amount
 * (in any order, case-insensitive). Positive amount = debit, negative = credit
 * (per spec Section 2, bank_transactions.amount convention).
 */
export function parseBankCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf('date');
  const descIdx = header.findIndex((h) => h.includes('desc'));
  const amountIdx = header.findIndex((h) => h.includes('amount'));

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('CSV must have "date" and "amount" columns (a "description" column is recommended).');
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const rawDate = cols[dateIdx];
    const date = new Date(rawDate).toISOString().slice(0, 10);
    return {
      date,
      description: descIdx !== -1 ? cols[descIdx] : '',
      amount: parseFloat(cols[amountIdx].replace(/[$,]/g, '')),
    };
  });
}

/**
 * Import parsed rows as pending bank transactions. external_id is derived
 * from the row content so re-importing the same file is a no-op (idempotent
 * on the bank_account_id + external_id unique constraint).
 */
export async function importBankTransactions({ userId, bankAccountId, rows }) {
  const records = rows.map((r) => ({
    user_id: userId,
    bank_account_id: bankAccountId,
    external_id: `${r.date}-${r.description}-${r.amount}`.slice(0, 200),
    transaction_date: r.date,
    description: r.description,
    amount: r.amount,
    status: 'pending',
  }));

  const { data, error } = await supabase
    .from('bank_transactions')
    .upsert(records, { onConflict: 'bank_account_id,external_id', ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return data;
}

/**
 * Suggest GL transactions that could match a pending bank transaction: same
 * account, same absolute amount, within a week, and not already linked to
 * another bank transaction.
 */
export async function findSuggestedMatches({ userId, glAccountId, bankTransaction }) {
  const bankDate = new Date(bankTransaction.transaction_date);
  const windowStart = new Date(bankDate);
  windowStart.setDate(windowStart.getDate() - 7);
  const windowEnd = new Date(bankDate);
  windowEnd.setDate(windowEnd.getDate() + 7);

  const [{ data: candidates, error: candError }, { data: alreadyLinked, error: linkError }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, transaction_date, description, amount, debit_account_id, credit_account_id')
      .eq('user_id', userId)
      .eq('amount', Math.abs(bankTransaction.amount))
      .in('status', ['posted', 'reconciled'])
      .gte('transaction_date', windowStart.toISOString().slice(0, 10))
      .lte('transaction_date', windowEnd.toISOString().slice(0, 10))
      .or(`debit_account_id.eq.${glAccountId},credit_account_id.eq.${glAccountId}`),
    supabase
      .from('bank_transactions')
      .select('gl_transaction_id')
      .eq('user_id', userId)
      .not('gl_transaction_id', 'is', null),
  ]);
  if (candError) throw candError;
  if (linkError) throw linkError;

  const linkedIds = new Set(alreadyLinked.map((b) => b.gl_transaction_id));
  return candidates.filter((c) => !linkedIds.has(c.id));
}

export async function matchBankTransaction({ bankTransactionId, glTransactionId }) {
  const { error } = await supabase
    .from('bank_transactions')
    .update({ gl_transaction_id: glTransactionId, status: 'matched' })
    .eq('id', bankTransactionId);
  if (error) throw error;
}

export async function unmatchBankTransaction(bankTransactionId) {
  const { error } = await supabase
    .from('bank_transactions')
    .update({ gl_transaction_id: null, status: 'pending' })
    .eq('id', bankTransactionId);
  if (error) throw error;
}

/**
 * Close out the month: every 'matched' bank transaction through the given
 * date becomes 'reconciled', and its linked GL transaction is locked to
 * 'reconciled' too (spec Section 2: "Month closed = reconciled").
 */
export async function reconcileMatchedTransactions({ userId, bankAccountId, throughDate }) {
  const { data: matched, error: fetchError } = await supabase
    .from('bank_transactions')
    .select('id, gl_transaction_id')
    .eq('user_id', userId)
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'matched')
    .lte('transaction_date', throughDate);
  if (fetchError) throw fetchError;
  if (matched.length === 0) return 0;

  const bankTxIds = matched.map((m) => m.id);
  const glTxIds = matched.map((m) => m.gl_transaction_id).filter(Boolean);

  const { error: bankUpdateError } = await supabase
    .from('bank_transactions')
    .update({ status: 'reconciled' })
    .in('id', bankTxIds);
  if (bankUpdateError) throw bankUpdateError;

  if (glTxIds.length > 0) {
    const { error: glUpdateError } = await supabase
      .from('transactions')
      .update({ status: 'reconciled' })
      .in('id', glTxIds);
    if (glUpdateError) throw glUpdateError;
  }

  return matched.length;
}
