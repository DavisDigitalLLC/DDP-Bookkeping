import { useState } from 'react';
import { useChartOfAccounts, useProductLines } from '../hooks/useChartOfAccounts';

function emptyForm() {
  return {
    serviceLine: '',
    department: '',
    productName: '',
    description: '',
    defaultRevenueAccountId: '',
    defaultExpenseAccountId: '',
  };
}

function ProductLineForm({ initial, isEditing, serviceLineOptions, departmentOptions, revenueAccounts, expenseAccounts, onSubmit, onCancel }) {
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
        <label htmlFor="serviceLine">Service line</label>
        <input id="serviceLine" required list="service-line-options" value={form.serviceLine} onChange={set('serviceLine')} />
        <datalist id="service-line-options">
          {serviceLineOptions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="form-row">
        <label htmlFor="department">Department (optional)</label>
        <input id="department" list="department-options" value={form.department} onChange={set('department')} />
        <datalist id="department-options">
          {departmentOptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>
      <div className="form-row">
        <label htmlFor="productName">Product name</label>
        <input id="productName" required value={form.productName} onChange={set('productName')} />
      </div>
      <div className="form-row">
        <label htmlFor="plDescription">Description</label>
        <input id="plDescription" value={form.description} onChange={set('description')} />
      </div>
      <div className="form-row">
        <label htmlFor="defaultRevenueAccountId">Default revenue account (optional)</label>
        <select id="defaultRevenueAccountId" value={form.defaultRevenueAccountId} onChange={set('defaultRevenueAccountId')}>
          <option value="">None -- choose manually each time</option>
          {revenueAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_number} — {a.account_name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="defaultExpenseAccountId">Default expense account (optional)</label>
        <select id="defaultExpenseAccountId" value={form.defaultExpenseAccountId} onChange={set('defaultExpenseAccountId')}>
          <option value="">None -- choose manually each time</option>
          {expenseAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_number} — {a.account_name}
            </option>
          ))}
        </select>
        <p className="tooltip-hint">
          When set, Transaction Entry auto-fills this account once this product line is picked (still overridable).
        </p>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add product line'}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ProductLines() {
  const { productLines, loading, createProductLine, updateProductLine, setProductLineActive } = useProductLines();
  const { accounts } = useChartOfAccounts();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const revenueAccounts = accounts.filter((a) => a.account_type === 'revenue');
  const expenseAccounts = accounts.filter((a) => a.account_type === 'expense');
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const serviceLineOptions = [...new Set(productLines.map((p) => p.service_line))];
  const departmentOptions = [...new Set(productLines.map((p) => p.department).filter(Boolean))];
  const editingProductLine = productLines.find((p) => p.id === editingId);

  const handleDeactivate = async (p) => {
    if (!window.confirm(`Deactivate ${p.product_name}? It will no longer appear when posting new transactions, but past history is preserved.`)) {
      return;
    }
    setError('');
    try {
      await setProductLineActive(p.id, false);
    } catch (err) {
      setError(err.message);
    }
  };

  const formProps = { serviceLineOptions, departmentOptions, revenueAccounts, expenseAccounts };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Product Lines</h3>
        {!adding && !editingId && (
          <button type="button" className="secondary" onClick={() => setAdding(true)}>
            + Add product line
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {adding && (
        <ProductLineForm
          {...formProps}
          onCancel={() => setAdding(false)}
          onSubmit={async (form) => {
            await createProductLine(form);
            setAdding(false);
          }}
        />
      )}

      {editingProductLine && (
        <ProductLineForm
          isEditing
          {...formProps}
          initial={{
            serviceLine: editingProductLine.service_line,
            department: editingProductLine.department ?? '',
            productName: editingProductLine.product_name,
            description: editingProductLine.description ?? '',
            defaultRevenueAccountId: editingProductLine.default_revenue_account_id ?? '',
            defaultExpenseAccountId: editingProductLine.default_expense_account_id ?? '',
          }}
          onCancel={() => setEditingId(null)}
          onSubmit={async (form) => {
            await updateProductLine(editingProductLine.id, form);
            setEditingId(null);
          }}
        />
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Service Line</th>
              <th>Department</th>
              <th>Product</th>
              <th>Default account</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productLines.map((p) => {
              const defaultAccount = accountsById.get(p.default_revenue_account_id) ?? accountsById.get(p.default_expense_account_id);
              return (
                <tr key={p.id}>
                  <td>{p.service_line}</td>
                  <td>{p.department ?? '—'}</td>
                  <td>{p.product_name}</td>
                  <td>{defaultAccount ? `${defaultAccount.account_number} — ${defaultAccount.account_name}` : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="secondary"
                      style={{ marginRight: 6 }}
                      onClick={() => {
                        setAdding(false);
                        setEditingId(p.id);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="secondary" onClick={() => handleDeactivate(p)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
