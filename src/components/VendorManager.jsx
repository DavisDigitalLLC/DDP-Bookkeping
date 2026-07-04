import { useState } from 'react';
import { useVendors } from '../hooks/useVendors';

function VendorForm({ initial, isEditing, onSubmit, onCancel }) {
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ vendorName });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ background: 'var(--ddp-soft-gray)', boxShadow: 'none' }}>
      <div className="form-row">
        <label htmlFor="vendorName">Vendor name</label>
        <input id="vendorName" required value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add vendor'}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function VendorManager() {
  const { vendors, loading, getOrCreateVendor, updateVendor, setVendorActive } = useVendors();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const editingVendor = vendors.find((v) => v.id === editingId);

  const handleDeactivate = async (v) => {
    if (
      !window.confirm(
        `Deactivate ${v.vendor_name}? It won't show up as a suggestion for new transactions, but past transactions keep their history.`
      )
    ) {
      return;
    }
    setError('');
    try {
      await setVendorActive(v.id, false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Vendors</h3>
        {!adding && !editingId && (
          <button type="button" className="secondary" onClick={() => setAdding(true)}>
            + Add vendor
          </button>
        )}
      </div>
      <p className="tooltip-hint" style={{ marginTop: 4 }}>
        Vendors are also created automatically the first time you type a new name in the Vendor field on Transaction
        Entry. Rename one here and its spending history stays linked (it won't split into two buckets in Trends).
      </p>

      {error && <p className="error-text">{error}</p>}

      {adding && (
        <VendorForm
          onCancel={() => setAdding(false)}
          onSubmit={async ({ vendorName }) => {
            await getOrCreateVendor(vendorName);
            setAdding(false);
          }}
        />
      )}

      {editingVendor && (
        <VendorForm
          isEditing
          initial={{ vendorName: editingVendor.vendor_name }}
          onCancel={() => setEditingId(null)}
          onSubmit={async ({ vendorName }) => {
            await updateVendor(editingVendor.id, { vendorName });
            setEditingId(null);
          }}
        />
      )}

      {loading ? (
        <p>Loading…</p>
      ) : vendors.length === 0 ? (
        <p className="tooltip-hint">No vendors yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id}>
                <td>{v.vendor_name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{ marginRight: 6 }}
                    onClick={() => {
                      setAdding(false);
                      setEditingId(v.id);
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="secondary" onClick={() => handleDeactivate(v)}>
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
