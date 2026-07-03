import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateHierarchicalTrends } from '../lib/trendsEngine';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
const STAT_COL_WIDTH = 100;
const LINE_ITEM_COL_WIDTH = 280;
const GL_COL_WIDTH = 64;

function formatMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
}

function money(n) {
  return n === 0 ? '—' : `$${Number(n).toFixed(2)}`;
}

const stickyLeftBase = {
  position: 'sticky',
  background: 'var(--color-surface)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
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

const STAT_COLS = [
  { key: 'total', label: 'Total', right: STAT_COL_WIDTH },
  { key: 'average', label: 'Average', right: 0 },
];

function TrendTable({ title, rows, months, description }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="card">
        <h3>{title}</h3>
        <p className="tooltip-hint">No activity in this window.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      {description && <p className="tooltip-hint" style={{ marginTop: 0 }}>{description}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ tableLayout: 'auto', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...stickyLeftBase, left: 0, width: GL_COL_WIDTH, minWidth: GL_COL_WIDTH, textAlign: 'left' }}>
                G/L#
              </th>
              <th
                style={{
                  ...stickyLeftBase,
                  left: GL_COL_WIDTH,
                  width: LINE_ITEM_COL_WIDTH,
                  minWidth: LINE_ITEM_COL_WIDTH,
                  textAlign: 'left',
                }}
              >
                Name
              </th>
              {months.map((m) => (
                <th key={m} style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '10px 14px' }}>
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
            {rows.map((row, i) => (
              <tr key={i} style={row.bold ? { background: 'var(--ddp-soft-gray)' } : undefined}>
                <td style={{ ...stickyLeftBase, left: 0, width: GL_COL_WIDTH, minWidth: GL_COL_WIDTH, fontWeight: row.bold ? 600 : 400 }}>
                  {row.glNumber || ''}
                </td>
                <td
                  title={row.label}
                  style={{
                    ...stickyLeftBase,
                    left: GL_COL_WIDTH,
                    width: LINE_ITEM_COL_WIDTH,
                    minWidth: LINE_ITEM_COL_WIDTH,
                    paddingLeft: 8 + row.level * 20,
                    fontWeight: row.bold ? 600 : 400,
                  }}
                >
                  {row.label}
                </td>
                {months.map((m) => (
                  <td key={m} style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '10px 14px', fontWeight: row.bold ? 600 : 400 }}>
                    {money(row.monthlyTotals[m])}
                  </td>
                ))}
                {STAT_COLS.map((c) => (
                  <td key={c.key} style={{ ...stickyRight(c.right), fontWeight: row.bold ? 600 : 400 }}>
                    {money(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
        const data = await generateHierarchicalTrends(user.id, { months });
        setTrends(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, months]);

  return (
    <div>
      <h2>Trends</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Revenue by Service Line › Department › Product, expenses by GL account (operating expenses broken out by
        vendor), over a rolling {months}-month window.
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
          <TrendTable title="Revenue" rows={trends?.revenueRows} months={trends?.months ?? []} />
          <TrendTable
            title="Operating Expenses"
            description="Each account is broken into vendors based on transaction description."
            rows={trends?.operatingRows}
            months={trends?.months ?? []}
          />
          <TrendTable
            title="Fixed Expenses"
            description="Taxes, payroll, and other fixed costs -- not broken out by vendor."
            rows={trends?.fixedRows}
            months={trends?.months ?? []}
          />
          <TrendTable title="Summary" rows={trends?.summaryRows} months={trends?.months ?? []} />
        </>
      )}
    </div>
  );
}
