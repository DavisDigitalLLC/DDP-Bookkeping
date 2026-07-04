import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import monogram from '../assets/ddp-monogram-transparent.png';

export default function Navigation() {
  const { signOut, user } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-brand">
        <img src={monogram} alt="DDP" className="nav-logo" />
        <span>DDP Bookkeeping</span>
      </div>
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Dashboard
      </NavLink>
      <NavLink to="/transactions" className={({ isActive }) => (isActive ? 'active' : '')}>
        Transactions
      </NavLink>
      <NavLink to="/receipts" className={({ isActive }) => (isActive ? 'active' : '')}>
        Receipts
      </NavLink>
      <NavLink to="/guides" className={({ isActive }) => (isActive ? 'active' : '')}>
        Deduction Guides
      </NavLink>
      <NavLink to="/reconciliation" className={({ isActive }) => (isActive ? 'active' : '')}>
        Bank Reconciliation
      </NavLink>
      <NavLink to="/import-kdp" className={({ isActive }) => (isActive ? 'active' : '')}>
        Import KDP Royalties
      </NavLink>

      <div className="nav-section-label">Reports</div>
      <NavLink to="/trends" className={({ isActive }) => (isActive ? 'active' : '')}>
        Trends
      </NavLink>
      <NavLink to="/balance-sheet" className={({ isActive }) => (isActive ? 'active' : '')}>
        Balance Sheet
      </NavLink>
      <NavLink to="/cash-flow" className={({ isActive }) => (isActive ? 'active' : '')}>
        Cash Flow
      </NavLink>
      <NavLink to="/tax-export" className={({ isActive }) => (isActive ? 'active' : '')}>
        Tax Export
      </NavLink>
      <NavLink to="/custom-report" className={({ isActive }) => (isActive ? 'active' : '')}>
        Custom Report
      </NavLink>

      <div className="nav-section-label">Manage</div>
      <NavLink to="/manage/products" className={({ isActive }) => (isActive ? 'active' : '')}>
        Products
      </NavLink>
      <NavLink to="/manage/vendors" className={({ isActive }) => (isActive ? 'active' : '')}>
        Vendors
      </NavLink>
      <NavLink to="/manage/accounts" className={({ isActive }) => (isActive ? 'active' : '')}>
        Chart of Accounts
      </NavLink>
      <NavLink to="/manage/close" className={({ isActive }) => (isActive ? 'active' : '')}>
        Month-End Close
      </NavLink>

      <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
        Settings
      </NavLink>
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <p className="tooltip-hint" style={{ padding: '0 8px' }}>{user?.email}</p>
        <button className="secondary" style={{ width: '100%' }} onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
