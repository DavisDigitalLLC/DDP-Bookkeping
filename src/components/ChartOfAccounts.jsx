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

export default function ChartOfAccounts() {
  const { accounts, loading } = useChartOfAccounts();
  const [balances, setBalances] = useState({});

  useEffect(() => {
    if (accounts.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        accounts.map(async (a) => [a.id, await getAccountBalance(a.id)])
      );
      setBalances(Object.fromEntries(entries));
    })();
  }, [accounts]);

  if (loading) return <p>Loading chart of accounts…</p>;

  const grouped = accounts.reduce((acc, a) => {
    (acc[a.account_type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="card">
      <h3>Chart of Accounts</h3>
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
                </tr>
              </thead>
              <tbody>
                {grouped[type].map((a) => (
                  <tr key={a.id}>
                    <td>{a.account_number}</td>
                    <td>{a.account_name}</td>
                    <td>{a.account_class}</td>
                    <td>{balances[a.id] != null ? `$${balances[a.id].toFixed(2)}` : '…'}</td>
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
