import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { currentMonthKey, generateEntityMonthlyTotals, shiftMonthKey } from '../lib/trendsEngine';

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export default function EntityTrendChart({ scope, monthsBack = 12, emptyHint }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !scope) return;
    let cancelled = false;
    (async () => {
      setError('');
      try {
        const endMonth = currentMonthKey();
        const startMonth = shiftMonthKey(endMonth, -(monthsBack - 1));
        const result = await generateEntityMonthlyTotals(user.id, { startMonth, endMonth, scope });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, scope, monthsBack]);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p>Loading…</p>;

  const hasActivity = data.revenueByMonth.some((v) => v !== 0) || data.expenseByMonth.some((v) => v !== 0);
  if (!hasActivity && emptyHint) return <p className="tooltip-hint">{emptyHint}</p>;

  const chartData = data.months.map((m, i) => ({
    month: formatMonthLabel(m),
    Revenue: data.revenueByMonth[i],
    Expenses: data.expenseByMonth[i],
    'Net Income': data.netByMonth[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
        <Legend />
        <Bar dataKey="Revenue" fill="#2f6f4f" />
        <Bar dataKey="Expenses" fill="#c96a4a" />
        <Line type="monotone" dataKey="Net Income" stroke="#1f2937" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
