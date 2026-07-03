import { useState } from 'react';
import { useBankAccounts } from '../hooks/useBankAccounts';
import { useChartOfAccounts } from '../hooks/useChartOfAccounts';
import BankReconciliation from '../components/BankReconciliation';

export default function Reconciliation() {
  const { bankAccounts, loading, createBankAccount } = useBankAccounts();
  const { accounts } = useChartOfAccounts();
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [glAccountId, setGlAccountId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const moneyAccounts = accounts.filter((a) => a.account_type === 'asset' || a.account_type === 'liability');
  const selected = bankAccounts.find((b) => b.id === selectedId) ?? bankAccounts[0];

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!glAccountId) {
      setError('Choose the GL account this bank account syncs to.');
      return;
    }
    setSaving(true);
    try {
      const created = await createBankAccount({ accountName, accountType, glAccountId });
      setSelectedId(created.id);
      setShowForm(false);
      setAccountName('');
      setGlAccountId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Bank Reconciliation</h2>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Bank accounts</h3>
          <button type="button" className="secondary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ Link bank account'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
            <div className="form-row">
              <label htmlFor="accountName">Name</label>
              <input
                id="accountName"
                type="text"
                required
                placeholder="Checking – Wells Fargo"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="accountType">Type</label>
              <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit_card">Credit card</option>
                <option value="money_market">Money market</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="glAccountId">Syncs to GL account</label>
              <select id="glAccountId" value={glAccountId} onChange={(e) => setGlAccountId(e.target.value)}>
                <option value="">Select account…</option>
                {moneyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create bank account'}
            </button>
          </form>
        )}

        {!loading && bankAccounts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {bankAccounts.map((b) => (
              <button
                key={b.id}
                type="button"
                className={selected?.id === b.id ? '' : 'secondary'}
                onClick={() => setSelectedId(b.id)}
              >
                {b.account_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && bankAccounts.length === 0 && !showForm && (
        <p className="tooltip-hint">No bank accounts linked yet. Click "+ Link bank account" to get started.</p>
      )}

      {selected && <BankReconciliation bankAccount={selected} />}
    </div>
  );
}
