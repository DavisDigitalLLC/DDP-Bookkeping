import ChartOfAccounts from '../components/ChartOfAccounts';
import ProfileSettings from '../components/ProfileSettings';
import { useProductLines } from '../hooks/useChartOfAccounts';

export default function Settings() {
  const { productLines, loading } = useProductLines();

  return (
    <div>
      <h2>Settings</h2>

      <ProfileSettings />

      <div className="card">
        <h3>Product Lines</h3>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Service Line</th>
                <th>Department</th>
                <th>Product</th>
              </tr>
            </thead>
            <tbody>
              {productLines.map((p) => (
                <tr key={p.id}>
                  <td>{p.service_line}</td>
                  <td>{p.department ?? '—'}</td>
                  <td>{p.product_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ChartOfAccounts />
    </div>
  );
}
