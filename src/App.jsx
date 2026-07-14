import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Journal from './pages/Journal';
import Receipts from './pages/Receipts';
import Guides from './pages/Guides';
import Reconciliation from './pages/Reconciliation';
import ImportKdpReport from './pages/ImportKdpReport';
import Trends from './pages/Trends';
import BalanceSheet from './pages/BalanceSheet';
import CashFlow from './pages/CashFlow';
import TaxExport from './pages/TaxExport';
import CustomReport from './pages/CustomReport';
import ManageProducts from './pages/ManageProducts';
import ManageVendors from './pages/ManageVendors';
import ManageAccounts from './pages/ManageAccounts';
import ManageClose from './pages/ManageClose';
import Settings from './pages/Settings';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <div className="app-shell">
              <Navigation />
              <main className="app-main">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/journal" element={<Journal />} />
                  <Route path="/receipts" element={<Receipts />} />
                  <Route path="/guides" element={<Guides />} />
                  <Route path="/reconciliation" element={<Reconciliation />} />
                  <Route path="/import-kdp" element={<ImportKdpReport />} />
                  <Route path="/trends" element={<Trends />} />
                  <Route path="/balance-sheet" element={<BalanceSheet />} />
                  <Route path="/cash-flow" element={<CashFlow />} />
                  <Route path="/tax-export" element={<TaxExport />} />
                  <Route path="/custom-report" element={<CustomReport />} />
                  <Route path="/manage/products" element={<ManageProducts />} />
                  <Route path="/manage/vendors" element={<ManageVendors />} />
                  <Route path="/manage/accounts" element={<ManageAccounts />} />
                  <Route path="/manage/close" element={<ManageClose />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
