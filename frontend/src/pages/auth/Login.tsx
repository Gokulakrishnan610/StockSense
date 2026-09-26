import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Boxes, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const Login: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) {
      setErrorMessage('Please enter both login ID/email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await login(loginId, password);
      showToast('success', 'Welcome back!', 'Successfully authenticated into StockSense.');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Invalid credentials or login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface-card)',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: '12px',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Boxes size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            StockSense Sign In
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Enter your credentials to access inventory platform
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-danger-subtle)',
              border: '1px solid var(--border-danger)',
              color: 'var(--color-danger)',
              fontSize: '0.8438rem',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Login ID or Email</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. manager@example.com or admin_user"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <div className="form-label">
              <span>Password</span>
              <Link
                to="/forgot-password"
                style={{ color: 'var(--color-primary)', fontSize: '0.7813rem', textDecoration: 'none' }}
              >
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '11px 16px' }}
            disabled={submitting}
          >
            {submitting ? (
              'Signing in...'
            ) : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};
