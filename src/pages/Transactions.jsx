import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ExpenseReportingGuide from '../components/ExpenseReportingGuide';
import TransactionEntry from '../components/TransactionEntry';

export default function Transactions() {
  const location = useLocation();
  const [editingTransaction, setEditingTransaction] = useState(location.state?.editingTransaction ?? null);

  useEffect(() => {
    if (location.state?.editingTransaction) setEditingTransaction(location.state.editingTransaction);
  }, [location.state]);

  return (
    <div>
      <ExpenseReportingGuide />

      <div>
        <h2>{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</h2>
        <TransactionEntry
          prefill={location.state?.prefill}
          editingTransaction={editingTransaction}
          onCancelEdit={() => setEditingTransaction(null)}
        />
      </div>

      <p className="tooltip-hint">
        Looking for a past transaction? See the <Link to="/journal">Journal</Link>.
      </p>
    </div>
  );
}
