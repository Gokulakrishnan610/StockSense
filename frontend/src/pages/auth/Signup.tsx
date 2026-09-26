import { PasswordInput } from '../../components/ui/PasswordInput';
import { AuthLayout } from '../../layouts/AuthLayout';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle } from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const Signup: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!loginId || loginId.length < 6) {
      errors.loginId = 'Login ID must be at least 6 characters.';
    }
    if (!email || !email.includes('@')) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!name.trim()) {
      errors.name = 'Full name is required.';
    }
    if (!password || password.length < 10) {
      errors.password = 'Password must be at least 10 characters.';
    }
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords must match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      await signup({
        login_id: loginId.trim(),
        email: email.trim(),
        name: name.trim(),
        password,
      });
      showToast('success', 'Account Created', 'Welcome to StockSense! Account registered successfully.');
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { message?: string; errors?: Array<{ field: string; message: string }> };
      if (error.errors && error.errors.length > 0) {
        const backendFieldErrors: Record<string, string> = {};
        error.errors.forEach((e) => {
          backendFieldErrors[e.field] = e.message;
        });
        setFieldErrors(backendFieldErrors);
      }
      setErrorMessage(error.message || 'Signup failed. Check details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" description="">
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
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
            {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Login ID (Username)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Min 6 chars, e.g. john_doe"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={submitting}
            />
            {fieldErrors.loginId && <div className="form-error">{fieldErrors.loginId}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="john@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            {fieldErrors.email && <div className="form-error">{fieldErrors.email}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Password (Min 10 characters)</label>
            <PasswordInput
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            {fieldErrors.password && <div className="form-error">{fieldErrors.password}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
            <PasswordInput id="confirm-password" className="form-input" autoComplete="new-password"
              value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={submitting} />
            {fieldErrors.confirmPassword && <div className="form-error">{fieldErrors.confirmPassword}</div>}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '11px 16px' }}
            disabled={submitting}
          >
            {submitting ? (
              'Creating Account...'
            ) : (
              <>
                <UserPlus size={16} /> Register Account
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
    </AuthLayout>
  );
};
