import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export function useBankAccounts() {
  const { user } = useAuth();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('bank_accounts')
      .select('*, gl_account:chart_of_accounts(account_name, account_number)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at');
    setBankAccounts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createBankAccount = useCallback(
    async ({ accountName, accountType, glAccountId }) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user.id,
          account_name: accountName,
          account_type: accountType,
          gl_account_id: glAccountId,
        })
        .select()
        .single();
      if (error) throw error;
      await refetch();
      return data;
    },
    [user, refetch]
  );

  return { bankAccounts, loading, refetch, createBankAccount };
}
