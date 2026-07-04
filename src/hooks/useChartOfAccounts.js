import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

const NORMAL_BALANCE_BY_TYPE = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
};

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

  const createAccount = useCallback(
    async ({ accountNumber, accountName, accountType, accountClass, description }) => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          user_id: user.id,
          account_number: accountNumber,
          account_name: accountName,
          account_type: accountType,
          account_class: accountClass || null,
          normal_balance: NORMAL_BALANCE_BY_TYPE[accountType],
          description: description || null,
        })
        .select()
        .single();
      if (error) throw error;
      await refetch();
      return data;
    },
    [user, refetch]
  );

  const updateAccount = useCallback(
    async (accountId, { accountNumber, accountName, accountClass, description }) => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .update({
          account_number: accountNumber,
          account_name: accountName,
          account_class: accountClass || null,
          description: description || null,
        })
        .eq('id', accountId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      await refetch();
      return data;
    },
    [user, refetch]
  );

  const setAccountActive = useCallback(
    async (accountId, isActive) => {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ is_active: isActive })
        .eq('id', accountId)
        .eq('user_id', user.id);
      if (error) throw error;
      await refetch();
    },
    [user, refetch]
  );

  return { accounts, loading, error, refetch, createAccount, updateAccount, setAccountActive };
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function useProductLines() {
  const { user } = useAuth();
  const [productLines, setProductLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createProductLine = useCallback(
    async ({ serviceLine, department, productName, description, defaultRevenueAccountId, defaultExpenseAccountId }) => {
      const { data, error } = await supabase
        .from('product_lines')
        .insert({
          user_id: user.id,
          service_line: serviceLine,
          department: department || null,
          product_name: productName,
          product_slug: slugify(productName),
          description: description || null,
          default_revenue_account_id: defaultRevenueAccountId || null,
          default_expense_account_id: defaultExpenseAccountId || null,
        })
        .select()
        .single();
      if (error) throw error;
      await refetch();
      return data;
    },
    [user, refetch]
  );

  const updateProductLine = useCallback(
    async (
      productLineId,
      { serviceLine, department, productName, description, defaultRevenueAccountId, defaultExpenseAccountId }
    ) => {
      const { data, error } = await supabase
        .from('product_lines')
        .update({
          service_line: serviceLine,
          department: department || null,
          product_name: productName,
          product_slug: slugify(productName),
          description: description || null,
          default_revenue_account_id: defaultRevenueAccountId || null,
          default_expense_account_id: defaultExpenseAccountId || null,
        })
        .eq('id', productLineId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      await refetch();
      return data;
    },
    [user, refetch]
  );

  const setProductLineActive = useCallback(
    async (productLineId, isActive) => {
      const { error } = await supabase
        .from('product_lines')
        .update({ is_active: isActive })
        .eq('id', productLineId)
        .eq('user_id', user.id);
      if (error) throw error;
      await refetch();
    },
    [user, refetch]
  );

  return { productLines, loading, refetch, createProductLine, updateProductLine, setProductLineActive };
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
