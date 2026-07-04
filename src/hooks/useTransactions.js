import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  deleteTransaction as deleteTransactionEngine,
  postItemizedTransaction as postItemizedTransactionEngine,
  postSplitTransaction as postSplitTransactionEngine,
  postTransaction as postTransactionEngine,
  updateTransaction as updateTransactionEngine,
} from '../lib/accountingEngine';
import { useAuth } from './useAuth';

export function useTransactions({ limit = 25 } = {}) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `*,
         debit_account:chart_of_accounts!transactions_debit_account_id_fkey(account_name, account_type),
         credit_account:chart_of_accounts!transactions_credit_account_id_fkey(account_name, account_type),
         product_line:product_lines(product_name),
         vendor:vendors(vendor_name)`
      )
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(limit);
    if (error) setError(error);
    else setTransactions(data);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const postTransaction = useCallback(
    async (params) => {
      const result = await postTransactionEngine({ userId: user.id, ...params });
      await refetch();
      return result;
    },
    [user, refetch]
  );

  const postSplitTransaction = useCallback(
    async (params) => {
      const result = await postSplitTransactionEngine({ userId: user.id, ...params });
      await refetch();
      return result;
    },
    [user, refetch]
  );

  const postItemizedTransaction = useCallback(
    async (params) => {
      const result = await postItemizedTransactionEngine({ userId: user.id, ...params });
      await refetch();
      return result;
    },
    [user, refetch]
  );

  const updateTransaction = useCallback(
    async (params) => {
      const result = await updateTransactionEngine({ userId: user.id, ...params });
      await refetch();
      return result;
    },
    [user, refetch]
  );

  const deleteTransaction = useCallback(
    async (transactionId) => {
      await deleteTransactionEngine({ userId: user.id, transactionId });
      await refetch();
    },
    [user, refetch]
  );

  return {
    transactions,
    loading,
    error,
    refetch,
    postTransaction,
    postSplitTransaction,
    postItemizedTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
