import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDrilldownOptions } from '../hooks/useDrilldownOptions';
import { useVendors } from '../hooks/useVendors';
import { applyReportFilters, exportReportToXlsx, fetchReportData } from '../lib/reportEngine';
import { currentMonthKey, shiftMonthKey } from '../lib/trendsEngine';

const ACCOUNT_TYPES = [
  { value: 'all', label: 'All account types' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
];

function defaultDateRange() {
  const end = currentMonthKey();
  const start = shiftMonthKey(end, -2);
  return { startDate: `${start}-01`, endDate: new Date().toISOString().slice(0, 10) };
}

export default function CustomReport() {
  const { user } = useAuth();
  const { serviceLines, products } = useDrilldownOptions();
  const { vendors } = useVendors();

  const [{ startDate, endDate }, setDateRange] = useState(defaultDateRange());
  const [accountType, setAccountType] = useState('all');
  const [selectedServiceLines, setSelectedServiceLines] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);

  const [rawData, setRawData] = useState(null); // { transactions, productLines, vendors }
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const filters = useMemo(
    () => ({
      accountType,
      serviceLines: selectedServiceLines,
      productLineIds: selectedProductIds,
      vendorIds: selectedVendorIds,
    }),
    [accountType, selectedServiceLines, selectedProductIds, selectedVendorIds]
  );

  const filteredTransactions = rawData ? applyReportFilters(rawData.transactions, filters) : [];

  const runReport = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await fetchReportData(user.id, { startDate, endDate });
      setRawData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setError('');
    setExporting(true);
    try {
      await exportReportToXlsx(filteredTransactions, { startDate, endDate });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const toggleInArray = (setter) => (value) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  return (
    <div>
      <h2>Custom Report</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Filter transactions by date range and any combination of account type, service line, product, and vendor,
        then preview and export to a formatted .xlsx workbook (Summary + Detail sheets).
      </p>

      <div className="card">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div className="form-row" style={{ maxWidth: 180 }}>
            <label htmlFor="reportStart">Start date</label>
            <input
              id="reportStart"
              type="date"
              value={startDate}
              onChange={(e) => setDateRange((r) => ({ ...r, startDate: e.target.value }))}
            />
          </div>
          <div className="form-row" style={{ maxWidth: 180 }}>
            <label htmlFor="reportEnd">End date</label>
            <input
              id="reportEnd"
              type="date"
              value={endDate}
              onChange={(e) => setDateRange((r) => ({ ...r, endDate: e.target.value }))}
            />
          </div>
          <div className="form-row" style={{ maxWidth: 220 }}>
            <label htmlFor="accountType">Account type</label>
            <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
          <div className="form-row" style={{ minWidth: 220 }}>
            <label>Service lines</label>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 8, maxHeight: 140, overflowY: 'auto' }}>
              {serviceLines.length === 0 && <p className="tooltip-hint" style={{ margin: 0 }}>None yet</p>}
              {serviceLines.map((sl) => (
                <label key={sl} style={{ display: 'flex', alignItems: 'center', fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={selectedServiceLines.includes(sl)}
                    onChange={() => toggleInArray(setSelectedServiceLines)(sl)}
                    style={{ width: 'auto', marginRight: 6 }}
                  />
                  {sl}
                </label>
              ))}
            </div>
          </div>

          <div className="form-row" style={{ minWidth: 240 }}>
            <label>Products</label>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 8, maxHeight: 140, overflowY: 'auto' }}>
              {products.length === 0 && <p className="tooltip-hint" style={{ margin: 0 }}>None yet</p>}
              {products.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleInArray(setSelectedProductIds)(p.id)}
                    style={{ width: 'auto', marginRight: 6 }}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-row" style={{ minWidth: 200 }}>
            <label>Vendors</label>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 8, maxHeight: 140, overflowY: 'auto' }}>
              {vendors.length === 0 && <p className="tooltip-hint" style={{ margin: 0 }}>None yet</p>}
              {vendors.map((v) => (
                <label key={v.id} style={{ display: 'flex', alignItems: 'center', fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={selectedVendorIds.includes(v.id)}
                    onChange={() => toggleInArray(setSelectedVendorIds)(v.id)}
                    style={{ width: 'auto', marginRight: 6 }}
                  />
                  {v.vendor_name}
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={runReport} disabled={loading}>
            {loading ? 'Running…' : 'Run report'}
          </button>
          {rawData && (
            <button type="button" className="secondary" onClick={handleExport} disabled={exporting || filteredTransactions.length === 0}>
              {exporting ? 'Exporting…' : `Export ${filteredTransactions.length} row(s) to .xlsx`}
            </button>
          )}
        </div>
      </div>

      {rawData && (
        <div className="card">
          <h3>Preview ({filteredTransactions.length} matching transactions)</h3>
          {filteredTransactions.length === 0 ? (
            <p className="tooltip-hint">No transactions match these filters.</p>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Notes</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Amount</th>
                    <th>Product</th>
                    <th>Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.slice(0, 500).map((t) => (
                    <tr key={t.id}>
                      <td>{t.transaction_date}</td>
                      <td>{t.description}</td>
                      <td title={t.notes || undefined}>{t.notes ? '📝' : '—'}</td>
                      <td>{t.debit_account?.account_name}</td>
                      <td>{t.credit_account?.account_name}</td>
                      <td>${Number(t.amount).toFixed(2)}</td>
                      <td>{t.product_line?.product_name ?? '—'}</td>
                      <td>{t.vendor?.vendor_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length > 500 && (
                <p className="tooltip-hint">Showing first 500 rows -- the exported file includes all {filteredTransactions.length}.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
