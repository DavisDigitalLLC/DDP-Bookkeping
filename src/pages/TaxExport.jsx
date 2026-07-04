import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { buildScheduleCCsv, downloadCsv, generateScheduleCData } from '../lib/scheduleCExport';

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function TaxExport() {
  const { user } = useAuth();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await generateScheduleCData(user.id, year);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, year]);

  const handleDownload = () => {
    if (!data) return;
    downloadCsv(`schedule-c-${year}.csv`, buildScheduleCCsv(data));
  };

  return (
    <div>
      <h2>Tax Export</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Schedule C-formatted export for self-filing: gross revenue by product line, itemized deductible expenses by
        category, net profit, and estimated SE tax.
      </p>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="form-row" style={{ maxWidth: 160 }}>
          <label htmlFor="taxYear">Tax year</label>
          <select id="taxYear" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handleDownload} disabled={!data || loading}>
          Download CSV
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="card">
            <h3>Gross Revenue by Product Line</h3>
            {data.revenueByProductLine.length === 0 ? (
              <p className="tooltip-hint">No revenue recorded for {year}.</p>
            ) : (
              <table>
                <tbody>
                  {data.revenueByProductLine.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td style={{ textAlign: 'right' }}>{money(r.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td>Gross Revenue</td>
                    <td style={{ textAlign: 'right' }}>{money(data.grossRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>Deductible Expenses by Category</h3>
            {data.expensesByCategory.length === 0 ? (
              <p className="tooltip-hint">No categorized expenses recorded for {year}.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Schedule C Line</th>
                    <th style={{ textAlign: 'right' }}>Deductible</th>
                    <th style={{ textAlign: 'right' }}>Non-Deductible</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expensesByCategory.map((e) => (
                    <tr key={e.categoryName}>
                      <td>{e.categoryName}</td>
                      <td>{e.taxLineItem}</td>
                      <td style={{ textAlign: 'right' }}>{money(e.deductibleAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{money(e.nonDeductibleAmount)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>{money(data.totalDeductibleExpenses)}</td>
                    <td style={{ textAlign: 'right' }}>{money(data.totalNonDeductibleExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
            <div className="card-grid">
              <div>
                <div className="metric-label">Gross revenue</div>
                <div className="metric-value">{money(data.grossRevenue)}</div>
              </div>
              <div>
                <div className="metric-label">Deductible expenses</div>
                <div className="metric-value">{money(data.totalDeductibleExpenses)}</div>
              </div>
              <div>
                <div className="metric-label">Net profit</div>
                <div className="metric-value">{money(data.netProfit)}</div>
              </div>
              <div>
                <div className="metric-label">Estimated SE tax</div>
                <div className="metric-value">{money(data.estimatedSETax)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
