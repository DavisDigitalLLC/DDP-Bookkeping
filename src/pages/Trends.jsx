import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { currentMonthKey, generateHierarchicalTrends, shiftMonthKey } from '../lib/trendsEngine';

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

const LABEL_MAX_CHARS = 22;
function truncateLabel(label) {
  if (!label || label.length <= LABEL_MAX_CHARS) return label;
  return `${label.slice(0, LABEL_MAX_CHARS - 1)}…`;
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
                  {truncateLabel(row.label)}
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

const THIS_MONTH = currentMonthKey();

export default function Trends() {
  const { user } = useAuth();
  const [trends, setTrends] = useState(null);
  const [windowMode, setWindowMode] = useState('rolling'); // 'rolling' | 'custom'
  const [rollingMonths, setRollingMonths] = useState(12);
  const [customStart, setCustomStart] = useState(shiftMonthKey(THIS_MONTH, -11));
  const [customEnd, setCustomEnd] = useState(THIS_MONTH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const startMonth = windowMode === 'rolling' ? shiftMonthKey(THIS_MONTH, -(rollingMonths - 1)) : customStart;
  const endMonth = windowMode === 'rolling' ? THIS_MONTH : customEnd;
  const rangeInvalid = windowMode === 'custom' && customStart > customEnd;

  useEffect(() => {
    if (!user || rangeInvalid) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await generateHierarchicalTrends(user.id, { startMonth, endMonth });
        setTrends(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, startMonth, endMonth, rangeInvalid]);

  return (
    <div>
      <h2>Trends</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Revenue and expenses by Service Line › Department › Product, plus expenses by GL account and vendor, from{' '}
        {startMonth} through {endMonth}.
      </p>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-row" style={{ maxWidth: 220 }}>
          <label htmlFor="windowMode">Timeframe</label>
          <select id="windowMode" value={windowMode} onChange={(e) => setWindowMode(e.target.value)}>
            <option value="rolling">Rolling window</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {windowMode === 'rolling' ? (
          <div className="form-row" style={{ maxWidth: 220 }}>
            <label htmlFor="monthsWindow">Rolling window</label>
            <select id="monthsWindow" value={rollingMonths} onChange={(e) => setRollingMonths(Number(e.target.value))}>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
          </div>
        ) : (
          <>
            <div className="form-row" style={{ maxWidth: 180 }}>
              <label htmlFor="customStart">Start month</label>
              <input
                id="customStart"
                type="month"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="form-row" style={{ maxWidth: 180 }}>
              <label htmlFor="customEnd">End month</label>
              <input id="customEnd" type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {rangeInvalid && <p className="error-text">Start month must be before the end month.</p>}
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <TrendTable title="Revenue" rows={trends?.revenueRows} months={trends?.months ?? []} />
          <TrendTable
            title="Expenses by Service Line / Department / Product"
            description="Same cost-center breakdown as Revenue, but for expense-side activity -- where is the money actually going, by product."
            rows={trends?.expenseByProductRows}
            months={trends?.months ?? []}
          />
          <TrendTable
            title="Expenses by GL Account"
            description="Each account is broken into vendors."
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
