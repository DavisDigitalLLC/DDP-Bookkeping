import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateProfitAndLoss } from '../lib/accountingEngine';
import { useTransactions } from '../hooks/useTransactions';

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function yearBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  return [start.toISOString().slice(0, 10), date.toISOString().slice(0, 10)];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { transactions } = useTransactions({ limit: 10 });
  const [monthPL, setMonthPL] = useState(null);
  const [yearPL, setYearPL] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [mStart, mEnd] = monthBounds();
        const [yStart, yEnd] = yearBounds();
        const [m, y] = await Promise.all([
          generateProfitAndLoss(user.id, mStart, mEnd),
          generateProfitAndLoss(user.id, yStart, yEnd),
        ]);
        setMonthPL(m);
        setYearPL(y);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [user]);

  return (
    <div>
      <h2>Dashboard</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="card-grid">
        <div className="card">
          <div className="metric-label">Revenue (this month)</div>
          <div className="metric-value">${(monthPL?.totals.grossRevenue ?? 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Expenses (this month)</div>
          <div className="metric-value">${(monthPL?.totals.totalExpenses ?? 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Net income (this month)</div>
          <div className="metric-value">${(monthPL?.totals.netIncome ?? 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Estimated SE tax (YTD)</div>
          <div className="metric-value">${(yearPL?.totals.estimatedSETax ?? 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Next quarterly payment</div>
          <div className="metric-value">${(yearPL?.totals.quarterlyEstimate ?? 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Net taxable income (YTD)</div>
          <div className="metric-value">${(yearPL?.totals.netTaxableIncome ?? 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <h3>Recent transactions</h3>
        {transactions.length === 0 ? (
          <p className="tooltip-hint">No transactions yet — post your first one from "New Transaction".</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Amount</th>
                <th>Product line</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.transaction_date}</td>
                  <td>{t.description}</td>
                  <td>{t.debit_account?.account_name}</td>
                  <td>{t.credit_account?.account_name}</td>
                  <td>${Number(t.amount).toFixed(2)}</td>
                  <td>{t.product_line?.product_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
