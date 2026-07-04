import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

function toPeriodMonth(monthKey) {
  return `${monthKey}-01`; // 'YYYY-MM' -> 'YYYY-MM-01'
}

export function useClosedPeriods() {
  const { user } = useAuth();
  const [closedPeriods, setClosedPeriods] = useState([]); // [{ id, period_month, closed_at, notes }]
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('period_closes')
      .select('*')
      .eq('user_id', user.id)
      .order('period_month', { ascending: false });
    setClosedPeriods(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const closedMonthKeys = useMemo(() => new Set(closedPeriods.map((p) => p.period_month.slice(0, 7))), [closedPeriods]);

  const isMonthClosed = useCallback((monthKey) => closedMonthKeys.has(monthKey), [closedMonthKeys]);

  const closePeriod = useCallback(
    async (monthKey, notes = null) => {
      const { error } = await supabase
        .from('period_closes')
        .insert({ user_id: user.id, period_month: toPeriodMonth(monthKey), notes });
      if (error) throw error;
      await refetch();
    },
    [user, refetch]
  );

  const reopenPeriod = useCallback(
    async (monthKey) => {
      const { error } = await supabase
        .from('period_closes')
        .delete()
        .eq('user_id', user.id)
        .eq('period_month', toPeriodMonth(monthKey));
      if (error) throw error;
      await refetch();
    },
    [user, refetch]
  );

  return { closedPeriods, loading, refetch, isMonthClosed, closePeriod, reopenPeriod };
}
