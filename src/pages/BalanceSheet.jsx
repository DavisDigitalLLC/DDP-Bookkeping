import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateBalanceSheet } from '../lib/accountingEngine';

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function AccountSection({ title, accounts, total }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4>{title}</h4>
      {accounts.length === 0 ? (
        <p className="tooltip-hint">No accounts.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.account_number}</td>
                <td>{a.account_name}</td>
                <td style={{ textAlign: 'right' }}>{money(a.balance)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td></td>
              <td>Total {title}</td>
              <td style={{ textAlign: 'right' }}>{money(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function BalanceSheet() {
  const { user } = useAuth();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await generateBalanceSheet(user.id, asOfDate);
        setSheet(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, asOfDate]);

  return (
    <div>
      <h2>Balance Sheet</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Assets = Liabilities + Equity, as of a single point in time.
      </p>

      <div className="form-row" style={{ maxWidth: 220, marginBottom: 20 }}>
        <label htmlFor="asOfDate">As of date</label>
        <input id="asOfDate" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="card">
          <AccountSection title="Assets" accounts={sheet.assets} total={sheet.totals.totalAssets} />
          <AccountSection title="Liabilities" accounts={sheet.liabilities} total={sheet.totals.totalLiabilities} />
          <AccountSection title="Equity" accounts={sheet.equity} total={sheet.totals.totalEquity - sheet.totals.currentPeriodNetIncome} />

          <div className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
            <div className="card-grid">
              <div>
                <div className="metric-label">Current period net income</div>
                <div className="metric-value">{money(sheet.totals.currentPeriodNetIncome)}</div>
              </div>
              <div>
                <div className="metric-label">Total equity (incl. net income)</div>
                <div className="metric-value">{money(sheet.totals.totalEquity)}</div>
              </div>
              <div>
                <div className="metric-label">Total assets</div>
                <div className="metric-value">{money(sheet.totals.totalAssets)}</div>
              </div>
              <div>
                <div className="metric-label">Liabilities + Equity</div>
                <div className="metric-value">
                  {money(sheet.totals.totalLiabilities + sheet.totals.totalEquity)}
                </div>
              </div>
            </div>
            <p className="tooltip-hint" style={{ marginTop: 16, marginBottom: 0 }}>
              {sheet.totals.balanced ? '✓ Balanced.' : '⚠ Out of balance — check for missing or misposted transactions.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
