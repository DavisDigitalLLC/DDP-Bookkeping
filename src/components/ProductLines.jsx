import { useState } from 'react';
import { useProductLines } from '../hooks/useChartOfAccounts';

function emptyForm() {
  return { serviceLine: '', department: '', productName: '', description: '' };
}

function ProductLineForm({ initial, isEditing, serviceLineOptions, departmentOptions, onSubmit, onCancel }) {
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
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

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
          serviceLineOptions={serviceLineOptions}
          departmentOptions={departmentOptions}
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
          serviceLineOptions={serviceLineOptions}
          departmentOptions={departmentOptions}
          initial={{
            serviceLine: editingProductLine.service_line,
            department: editingProductLine.department ?? '',
            productName: editingProductLine.product_name,
            description: editingProductLine.description ?? '',
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productLines.map((p) => (
              <tr key={p.id}>
                <td>{p.service_line}</td>
                <td>{p.department ?? '—'}</td>
                <td>{p.product_name}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
