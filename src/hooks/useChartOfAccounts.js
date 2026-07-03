import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export function useChartOfAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('account_number');
    if (error) setError(error);
    else setAccounts(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { accounts, loading, error, refetch };
}

export function useProductLines() {
  const { user } = useAuth();
  const [productLines, setProductLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('product_lines')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('service_line')
        .order('department')
        .order('product_name');
      setProductLines(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return { productLines, loading };
}

export function useExpenseCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('category_name');
      setCategories(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return { categories, loading };
}
