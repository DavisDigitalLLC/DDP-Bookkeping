import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import banner from '../assets/banner-original.png';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp({ email, password, fullName, companyName });
        setInfo('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
      } else {
        await signIn({ email, password });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <img src={banner} alt="DDP Bookkeeping" className="auth-banner" />
      <div className="card auth-card">
        <h2>{mode === 'signup' ? 'Create your account' : 'Sign in to DDP Bookkeeping'}</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="form-row">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="companyName">Company name</label>
                <input
                  id="companyName"
                  type="text"
                  placeholder="Davis Digital & Publishing LLC"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {info && <p className="tooltip-hint">{info}</p>}

          <button type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
        </form>
        <p className="tooltip-hint" style={{ marginTop: 12 }}>
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setError('');
              setInfo('');
              setMode(mode === 'signup' ? 'signin' : 'signup');
            }}
          >
            {mode === 'signup' ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
