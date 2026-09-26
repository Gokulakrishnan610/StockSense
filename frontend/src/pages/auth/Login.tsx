import { PasswordInput } from '../../components/ui/PasswordInput';
import { AuthLayout } from '../../layouts/AuthLayout';
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, AlertCircle } from '../../components/ui/icons';
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
    <AuthLayout title="Login to your account" description="">
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
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
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
            <PasswordInput
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
                <LogIn size={16} /> Sign In
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
    </AuthLayout>
  );
};
