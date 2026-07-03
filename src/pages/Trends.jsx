import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateLineItemTrends } from '../lib/accountingEngine';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });

function formatMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

export default function Trends() {
  const { user } = useAuth();
  const [trends, setTrends] = useState(null);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await generateLineItemTrends(user.id, { months });
        setTrends(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, months]);

  const revenueItems = trends?.lineItems.filter((i) => i.accountType === 'revenue') ?? [];
  const expenseItems = trends?.lineItems.filter((i) => i.accountType === 'expense') ?? [];

  const renderTable = (items, label) => (
    <div className="card">
      <h3>{label}</h3>
      {items.length === 0 ? (
        <p className="tooltip-hint">No activity in this window.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--color-surface)' }}>Line item</th>
                {trends.months.map((m) => (
                  <th key={m} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatMonth(m)}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Avg</th>
                <th style={{ textAlign: 'right' }}>High</th>
                <th style={{ textAlign: 'right' }}>Low</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.accountId}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--color-surface)', whiteSpace: 'nowrap' }}>
                    {item.accountNumber} — {item.accountName}
                  </td>
                  {trends.months.map((m) => (
                    <td key={m} style={{ textAlign: 'right' }}>
                      {item.monthlyTotals[m] > 0 ? money(item.monthlyTotals[m]) : '—'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(item.average)}</td>
                  <td style={{ textAlign: 'right' }}>{money(item.high)}</td>
                  <td style={{ textAlign: 'right' }}>{money(item.low)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h2>Trends</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Month-over-month totals by line item, with a rolling {months}-month average, high, low, and total.
      </p>

      <div className="form-row" style={{ maxWidth: 220, marginBottom: 20 }}>
        <label htmlFor="monthsWindow">Rolling window</label>
        <select id="monthsWindow" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={6}>6 months</option>
          <option value={12}>12 months</option>
          <option value={24}>24 months</option>
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {renderTable(revenueItems, 'Revenue')}
          {renderTable(expenseItems, 'Expenses')}
        </>
      )}
    </div>
  );
}
