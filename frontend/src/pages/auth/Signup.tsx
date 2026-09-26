import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const Signup: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
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
          maxWidth: '460px',
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
            Create StockSense Account
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Register as Warehouse Staff to access inventory
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
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            {fieldErrors.password && <div className="form-error">{fieldErrors.password}</div>}
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
                <UserPlus size={18} /> Register Account
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
      </div>
    </div>
  );
};
