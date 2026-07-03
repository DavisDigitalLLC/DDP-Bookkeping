import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navigation() {
  const { signOut, user } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-brand">DDP Bookkeeping</div>
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
      <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
        Settings & Chart of Accounts
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
