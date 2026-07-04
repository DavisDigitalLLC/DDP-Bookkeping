import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateCashFlow } from '../lib/accountingEngine';

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function monthStartEnd(monthsBack = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function ActivitySection({ title, section }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4>{title}</h4>
      {section.lineItems.length === 0 ? (
        <p className="tooltip-hint">No activity in this period.</p>
      ) : (
        <table>
          <tbody>
            {section.lineItems.map((item) => (
              <tr key={item.accountName}>
                <td>{item.accountName}</td>
                <td style={{ textAlign: 'right' }}>{money(item.amount)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td>Net cash from {title.toLowerCase()}</td>
              <td style={{ textAlign: 'right' }}>{money(section.total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CashFlow() {
  const { user } = useAuth();
  const [defaultStart, defaultEnd] = monthStartEnd(0);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await generateCashFlow(user.id, periodStart, periodEnd);
        setStatement(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, periodStart, periodEnd]);

  return (
    <div>
      <h2>Cash Flow Statement</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Cash-basis: every transaction touching a cash account, classified by what it was for.
      </p>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="form-row" style={{ maxWidth: 180 }}>
          <label htmlFor="periodStart">Start date</label>
          <input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="form-row" style={{ maxWidth: 180 }}>
          <label htmlFor="periodEnd">End date</label>
          <input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="card">
          <ActivitySection title="Operating Activities" section={statement.operating} />
          <ActivitySection title="Investing Activities" section={statement.investing} />
          <ActivitySection title="Financing Activities" section={statement.financing} />

          <div className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
            <div className="card-grid">
              <div>
                <div className="metric-label">Beginning cash</div>
                <div className="metric-value">{money(statement.beginningCash)}</div>
              </div>
              <div>
                <div className="metric-label">Net change in cash</div>
                <div className="metric-value">{money(statement.netChange)}</div>
              </div>
              <div>
                <div className="metric-label">Ending cash</div>
                <div className="metric-value">{money(statement.endingCash)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
