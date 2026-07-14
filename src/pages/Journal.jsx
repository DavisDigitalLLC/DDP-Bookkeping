import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChartOfAccounts, useProductLines } from '../hooks/useChartOfAccounts';
import { useClosedPeriods } from '../hooks/useClosedPeriods';
import { useVendors } from '../hooks/useVendors';
import { useTransactions } from '../hooks/useTransactions';
import { supabase } from '../lib/supabaseClient';

function classify(t) {
  if (t.debit_account?.account_type === 'expense') return 'expense';
  if (t.credit_account?.account_type === 'revenue') return 'revenue';
  return 'other';
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long' });
}

export default function Journal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accounts } = useChartOfAccounts();
  const { productLines } = useProductLines();
  const { vendors } = useVendors();
  const { deleteTransaction } = useTransactions({ limit: 1 });
  const { isMonthClosed } = useClosedPeriods();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [expandedYears, setExpandedYears] = useState(() => new Set([String(new Date().getFullYear())]));
  const [expandedMonths, setExpandedMonths] = useState(() => new Set());

  const [startDate, setStartDate] = useState(searchParams.get('start') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end') || '');
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [accountId, setAccountId] = useState(searchParams.get('accountId') || '');
  const [productLineId, setProductLineId] = useState(searchParams.get('productLineId') || '');
  const [serviceLine, setServiceLine] = useState(searchParams.get('serviceLine') || '');
  const [department, setDepartment] = useState(searchParams.get('department') || '');
  const [vendorId, setVendorId] = useState(searchParams.get('vendorId') || '');
  const [vendorName, setVendorName] = useState(searchParams.get('vendorName') || '');

  const hasActiveFilter = Boolean(
    startDate || endDate || type !== 'all' || accountId || productLineId || serviceLine || vendorId || vendorName
  );

  const refetch = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('transactions')
      .select(
        `*,
         debit_account:chart_of_accounts!transactions_debit_account_id_fkey(account_number, account_name, account_type),
         credit_account:chart_of_accounts!transactions_credit_account_id_fkey(account_number, account_name, account_type),
         product_line:product_lines(service_line, department, product_name),
         vendor:vendors(vendor_name)`
      )
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(5000);
    if (fetchError) setError(fetchError.message);
    else setTransactions(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Landing from a Trends drill-through: expand straight into filtered results.
  useEffect(() => {
    if (searchParams.toString()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (startDate && t.transaction_date < startDate) return false;
      if (endDate && t.transaction_date > endDate) return false;
      if (type !== 'all' && classify(t) !== type) return false;
      if (accountId && t.debit_account_id !== accountId && t.credit_account_id !== accountId) return false;
      if (productLineId && t.product_line_id !== productLineId) return false;
      if (serviceLine) {
        if (!t.product_line || t.product_line.service_line !== serviceLine) return false;
        if (department && (t.product_line.department ?? '') !== department) return false;
      }
      if (vendorId && t.vendor_id !== vendorId) return false;
      if (vendorName) {
        const label = t.vendor?.vendor_name?.trim() || t.description?.trim() || '';
        if (label !== vendorName) return false;
      }
      return true;
    });
  }, [transactions, startDate, endDate, type, accountId, productLineId, serviceLine, department, vendorId, vendorName]);

  const folders = useMemo(() => {
    const byYear = new Map();
    for (const t of transactions) {
      const year = t.transaction_date.slice(0, 4);
      const monthKey = t.transaction_date.slice(0, 7);
      if (!byYear.has(year)) byYear.set(year, new Map());
      const byMonth = byYear.get(year);
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey).push(t);
    }
    return [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const toggleYear = (year) =>
    setExpandedYears((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  const toggleMonth = (monthKey) =>
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setType('all');
    setAccountId('');
    setProductLineId('');
    setServiceLine('');
    setDepartment('');
    setVendorId('');
    setVendorName('');
  };

  const handleEdit = (t) => navigate('/transactions', { state: { editingTransaction: t } });

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete "${t.description || 'this transaction'}" for $${Number(t.amount).toFixed(2)}? This cannot be undone.`)) {
      return;
    }
    setError('');
    setDeletingId(t.id);
    try {
      await deleteTransaction(t.id);
      await refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const renderRows = (rows) => (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Amount</th>
          <th>Vendor</th>
          <th>Product</th>
          <th>Deductible</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const periodClosed = isMonthClosed(t.transaction_date.slice(0, 7));
          const locked = t.status === 'reconciled' || periodClosed;
          const lockReason = periodClosed
            ? 'This month is closed -- reopen it in Manage > Month-End Close to edit'
            : t.status === 'reconciled'
              ? 'Unreconcile in Bank Reconciliation before editing'
              : '';
          return (
            <tr key={t.id}>
              <td>
                {t.transaction_date}
                {periodClosed && ' 🔒'}
              </td>
              <td title={t.notes || undefined}>
                {t.description}
                {t.notes && ' 📝'}
              </td>
              <td>{t.debit_account?.account_name}</td>
              <td>{t.credit_account?.account_name}</td>
              <td>${Number(t.amount).toFixed(2)}</td>
              <td>{t.vendor?.vendor_name ?? '—'}</td>
              <td>{t.product_line?.product_name ?? '—'}</td>
              <td>{t.is_tax_deductible === null ? '—' : t.is_tax_deductible ? 'Yes' : 'No'}</td>
              <td>{t.status}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="secondary" onClick={() => handleEdit(t)} disabled={locked} title={lockReason} style={{ marginRight: 6 }}>
                  Edit
                </button>
                <button type="button" className="secondary" onClick={() => handleDelete(t)} disabled={locked || deletingId === t.id} title={lockReason}>
                  {deletingId === t.id ? 'Deleting…' : 'Delete'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div>
      <h2>Journal</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Browse by year and month, or search across everything by date range, type, account, product, or vendor.
      </p>

      <div className="card">
        <h3>Search</h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div className="form-row" style={{ maxWidth: 170 }}>
            <label htmlFor="hStart">Start date</label>
            <input id="hStart" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-row" style={{ maxWidth: 170 }}>
            <label htmlFor="hEnd">End date</label>
            <input id="hEnd" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="form-row" style={{ maxWidth: 160 }}>
            <label htmlFor="hType">Type</label>
            <select id="hType" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All</option>
              <option value="expense">Expense</option>
              <option value="revenue">Revenue</option>
              <option value="other">Other (transfers)</option>
            </select>
          </div>
          <div className="form-row" style={{ maxWidth: 240 }}>
            <label htmlFor="hAccount">G/L account</label>
            <select id="hAccount" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Any</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number} — {a.account_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row" style={{ maxWidth: 240 }}>
            <label htmlFor="hProduct">Product</label>
            <select
              id="hProduct"
              value={productLineId}
              onChange={(e) => {
                setProductLineId(e.target.value);
                setServiceLine('');
                setDepartment('');
              }}
            >
              <option value="">Any</option>
              {productLines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.service_line} {p.department ? `› ${p.department}` : ''} › {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row" style={{ maxWidth: 200 }}>
            <label htmlFor="hVendor">Vendor</label>
            <select id="hVendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Any</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hasActiveFilter && (
          <button type="button" className="secondary" style={{ marginTop: 12 }} onClick={clearFilters}>
            Clear filters
          </button>
        )}
        {(serviceLine || productLineId || vendorName || accountId) && (
          <p className="tooltip-hint" style={{ marginTop: 8 }}>
            {serviceLine && `Filtered to ${serviceLine}${department ? ` › ${department}` : ''} from a Trends drill-through. `}
            {productLineId && !serviceLine && 'Filtered to one product from a Trends drill-through. '}
            {vendorName && `Filtered to vendor "${vendorName}" from a Trends drill-through. `}
            {accountId && !productLineId && !serviceLine && !vendorName && 'Filtered from a Trends drill-through. '}
            <button type="button" className="secondary" onClick={clearFilters} style={{ marginLeft: 4 }}>
              Clear
            </button>
          </p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : hasActiveFilter ? (
        <div className="card">
          <h3>{filtered.length} matching transaction(s)</h3>
          {filtered.length === 0 ? <p className="tooltip-hint">No transactions match these filters.</p> : renderRows(filtered)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <p className="tooltip-hint">Nothing posted yet.</p>
        </div>
      ) : (
        folders.map(([year, byMonth]) => {
          const yearExpanded = expandedYears.has(year);
          const monthEntries = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
          const yearCount = monthEntries.reduce((s, [, rows]) => s + rows.length, 0);
          return (
            <div className="card" key={year}>
              <button
                type="button"
                className="secondary"
                onClick={() => toggleYear(year)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
              >
                <strong>{year}</strong>
                <span>{yearCount} transaction(s) {yearExpanded ? '▲' : '▼'}</span>
              </button>

              {yearExpanded &&
                monthEntries.map(([monthKey, rows]) => {
                  const monthExpanded = expandedMonths.has(monthKey);
                  return (
                    <div key={monthKey} style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => toggleMonth(monthKey)}
                        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{monthLabel(monthKey)}</span>
                        <span>{rows.length} transaction(s) {monthExpanded ? '▲' : '▼'}</span>
                      </button>
                      {monthExpanded && <div style={{ marginTop: 8, overflowX: 'auto' }}>{renderRows(rows)}</div>}
                    </div>
                  );
                })}
            </div>
          );
        })
      )}
    </div>
  );
}
