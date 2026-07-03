import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateLineItemTrends } from '../lib/accountingEngine';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
const STAT_COL_WIDTH = 96;
// Right-side sticky offsets so Avg/High/Low/Total stay visible without scrolling.
const STAT_COLS = [
  { key: 'average', label: 'Avg', right: STAT_COL_WIDTH * 3, bold: true },
  { key: 'high', label: 'High', right: STAT_COL_WIDTH * 2 },
  { key: 'low', label: 'Low', right: STAT_COL_WIDTH * 1 },
  { key: 'total', label: 'Total', right: 0, bold: true },
];

function formatMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

const LINE_ITEM_COL_WIDTH = 240;
const stickyLeft = {
  position: 'sticky',
  left: 0,
  background: 'var(--color-surface)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  width: LINE_ITEM_COL_WIDTH,
  minWidth: LINE_ITEM_COL_WIDTH,
  maxWidth: LINE_ITEM_COL_WIDTH,
  zIndex: 2,
};
const stickyRight = (right) => ({
  position: 'sticky',
  right,
  background: 'var(--color-surface)',
  textAlign: 'right',
  width: STAT_COL_WIDTH,
  minWidth: STAT_COL_WIDTH,
  zIndex: 2,
});

export default function Trends() {
  const { user } = useAuth();
  const [trends, setTrends] = useState(null);
  const [months, setMonths] = useState(12);
  const [groupBy, setGroupBy] = useState('account');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await generateLineItemTrends(user.id, { months, groupBy });
        setTrends(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, months, groupBy]);

  const revenueItems = trends?.lineItems.filter((i) => i.accountType === 'revenue') ?? [];
  const expenseItems = trends?.lineItems.filter((i) => i.accountType === 'expense') ?? [];

  const renderTable = (items, label) => (
    <div className="card">
      <h3>{label}</h3>
      {items.length === 0 ? (
        <p className="tooltip-hint">No activity in this window.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...stickyLeft, textAlign: 'left' }}>Line item</th>
                {trends.months.map((m) => (
                  <th key={m} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatMonth(m)}
                  </th>
                ))}
                {STAT_COLS.map((c) => (
                  <th key={c.key} style={stickyRight(c.right)}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td style={stickyLeft} title={item.label}>{item.label}</td>
                  {trends.months.map((m) => (
                    <td key={m} style={{ textAlign: 'right' }}>
                      {item.monthlyTotals[m] > 0 ? money(item.monthlyTotals[m]) : '—'}
                    </td>
                  ))}
                  {STAT_COLS.map((c) => (
                    <td key={c.key} style={{ ...stickyRight(c.right), fontWeight: c.bold ? 600 : 400 }}>
                      {money(item[c.key])}
                    </td>
                  ))}
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
        Avg/High/Low/Total stay pinned on the right as you scroll through months.
      </p>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="form-row" style={{ maxWidth: 220 }}>
          <label htmlFor="monthsWindow">Rolling window</label>
          <select id="monthsWindow" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>
        <div className="form-row" style={{ maxWidth: 260 }}>
          <label htmlFor="groupBy">Break out by</label>
          <select id="groupBy" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="account">GL account</option>
            <option value="productLine">Product line</option>
          </select>
        </div>
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
