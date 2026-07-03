import { useLocation } from 'react-router-dom';
import TransactionEntry from '../components/TransactionEntry';
import { useTransactions } from '../hooks/useTransactions';

export default function Transactions() {
  const { transactions, refetch } = useTransactions({ limit: 50 });
  const location = useLocation();

  return (
    <div>
      <h2>New Transaction</h2>
      <TransactionEntry onPosted={refetch} prefill={location.state?.prefill} />

      <div className="card">
        <h3>All transactions</h3>
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
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.transaction_date}</td>
                  <td>{t.description}</td>
                  <td>{t.debit_account?.account_name}</td>
                  <td>{t.credit_account?.account_name}</td>
                  <td>${Number(t.amount).toFixed(2)}</td>
                  <td>{t.is_tax_deductible === null ? '—' : t.is_tax_deductible ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
