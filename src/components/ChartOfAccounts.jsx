import { useEffect, useState } from 'react';
import { useChartOfAccounts } from '../hooks/useChartOfAccounts';
import { getAccountBalance } from '../lib/accountingEngine';

const TYPE_LABELS = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

const ACCOUNT_CLASS_SUGGESTIONS = [
  'current_asset',
  'fixed_asset',
  'current_liability',
  'long_term_liability',
  'equity',
  'operating_revenue',
  'other_revenue',
  'cost_of_goods_sold',
  'operating_expense',
  'fixed_expense',
];

function emptyForm() {
  return { accountNumber: '', accountName: '', accountType: 'expense', accountClass: '', description: '' };
}

function AccountForm({ initial, isEditing, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ?? emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
      <div className="form-row">
        <label htmlFor="accountNumber">Account number</label>
        <input id="accountNumber" required value={form.accountNumber} onChange={set('accountNumber')} placeholder="e.g. 6060" />
      </div>
      <div className="form-row">
        <label htmlFor="accountName">Account name</label>
        <input id="accountName" required value={form.accountName} onChange={set('accountName')} />
      </div>
      <div className="form-row">
        <label htmlFor="accountType">Type</label>
        <select id="accountType" required value={form.accountType} onChange={set('accountType')} disabled={isEditing}>
          <option value="asset">Asset</option>
          <option value="liability">Liability</option>
          <option value="equity">Equity</option>
          <option value="revenue">Revenue</option>
          <option value="expense">Expense</option>
        </select>
        {isEditing && <p className="tooltip-hint">Type can't change after creation -- it would corrupt historical reports.</p>}
      </div>
      <div className="form-row">
        <label htmlFor="accountClass">Class</label>
        <input id="accountClass" list="account-class-options" value={form.accountClass} onChange={set('accountClass')} />
        <datalist id="account-class-options">
          {ACCOUNT_CLASS_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="form-row">
        <label htmlFor="accountDescription">Description</label>
        <input id="accountDescription" value={form.description} onChange={set('description')} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add account'}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ChartOfAccounts() {
  const { accounts, loading, createAccount, updateAccount, setAccountActive } = useChartOfAccounts();
  const [balances, setBalances] = useState({});
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (accounts.length === 0) return;
    (async () => {
      const entries = await Promise.all(accounts.map(async (a) => [a.id, await getAccountBalance(a.id)]));
      setBalances(Object.fromEntries(entries));
    })();
  }, [accounts]);

  if (loading) return <p>Loading chart of accounts…</p>;

  const grouped = accounts.reduce((acc, a) => {
    (acc[a.account_type] ??= []).push(a);
    return acc;
  }, {});

  const editingAccount = accounts.find((a) => a.id === editingId);

  const handleDeactivate = async (account) => {
    if (!window.confirm(`Deactivate ${account.account_number} — ${account.account_name}? It will no longer appear when posting new transactions, but past history is preserved.`)) {
      return;
    }
    setError('');
    try {
      await setAccountActive(account.id, false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Chart of Accounts</h3>
        {!adding && !editingId && (
          <button type="button" className="secondary" onClick={() => setAdding(true)}>
            + Add account
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {adding && (
        <AccountForm
          onCancel={() => setAdding(false)}
          onSubmit={async (form) => {
            await createAccount(form);
            setAdding(false);
          }}
        />
      )}

      {editingAccount && (
        <AccountForm
          isEditing
          initial={{
            accountNumber: editingAccount.account_number,
            accountName: editingAccount.account_name,
            accountType: editingAccount.account_type,
            accountClass: editingAccount.account_class ?? '',
            description: editingAccount.description ?? '',
          }}
          onCancel={() => setEditingId(null)}
          onSubmit={async (form) => {
            await updateAccount(editingAccount.id, form);
            setEditingId(null);
          }}
        />
      )}

      {Object.entries(TYPE_LABELS).map(([type, label]) =>
        grouped[type]?.length ? (
          <div key={type} style={{ marginBottom: 20 }}>
            <h4>{label}</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Account</th>
                  <th>Class</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grouped[type].map((a) => (
                  <tr key={a.id}>
                    <td>{a.account_number}</td>
                    <td>{a.account_name}</td>
                    <td>{a.account_class}</td>
                    <td>{balances[a.id] != null ? `$${balances[a.id].toFixed(2)}` : '…'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ marginRight: 6 }}
                        onClick={() => {
                          setAdding(false);
                          setEditingId(a.id);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="secondary" onClick={() => handleDeactivate(a)}>
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      )}
    </div>
  );
}
