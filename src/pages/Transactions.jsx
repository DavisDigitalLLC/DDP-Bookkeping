import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TransactionEntry from '../components/TransactionEntry';
import { useTransactions } from '../hooks/useTransactions';

export default function Transactions() {
  const { transactions, refetch, deleteTransaction } = useTransactions({ limit: 50 });
  const location = useLocation();
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  const handleEdit = (t) => {
    setError('');
    setEditingTransaction(t);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete "${t.description || 'this transaction'}" for $${Number(t.amount).toFixed(2)}? This cannot be undone.`)) {
      return;
    }
    setError('');
    setDeletingId(t.id);
    try {
      await deleteTransaction(t.id);
      if (editingTransaction?.id === t.id) setEditingTransaction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div ref={formRef}>
        <h2>{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</h2>
        <TransactionEntry
          onPosted={refetch}
          prefill={location.state?.prefill}
          editingTransaction={editingTransaction}
          onCancelEdit={() => setEditingTransaction(null)}
        />
      </div>

      <div className="card">
        <h3>All transactions (journal)</h3>
        {error && <p className="error-text">{error}</p>}
        {transactions.length === 0 ? (
          <p className="tooltip-hint">Nothing posted yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Amount</th>
                <th>Deductible</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const locked = t.status === 'reconciled';
                return (
                  <tr key={t.id}>
                    <td>{t.transaction_date}</td>
                    <td>{t.description}</td>
                    <td>{t.debit_account?.account_name}</td>
                    <td>{t.credit_account?.account_name}</td>
                    <td>${Number(t.amount).toFixed(2)}</td>
                    <td>{t.is_tax_deductible === null ? '—' : t.is_tax_deductible ? 'Yes' : 'No'}</td>
                    <td>{t.status}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleEdit(t)}
                        disabled={locked}
                        title={locked ? 'Unreconcile in Bank Reconciliation before editing' : ''}
                        style={{ marginRight: 6 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleDelete(t)}
                        disabled={locked || deletingId === t.id}
                        title={locked ? 'Unreconcile in Bank Reconciliation before deleting' : ''}
                      >
                        {deletingId === t.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
