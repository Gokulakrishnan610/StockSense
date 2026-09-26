import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const ResetPassword: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const resetTokenState = (location.state as { reset_token?: string })?.reset_token || '';

  const [resetToken, setResetToken] = useState(resetTokenState);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      setErrorMessage('Missing valid reset token. Please verify OTP first.');
      return;
    }
    if (!newPassword || newPassword.length < 10) {
      setErrorMessage('New password must be at least 10 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await api.resetPassword(resetToken, newPassword);
      showToast('success', 'Password Reset Successful', 'Your password has been updated. Please sign in.');
      navigate('/login');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Failed to reset password. Challenge token may have expired.');
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
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Lock size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            Set New Password
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Enter a strong new password for your StockSense account
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
          {!resetTokenState && (
            <div className="form-group">
              <label className="form-label">Reset Token</label>
              <input
                type="text"
                className="form-input"
                placeholder="Paste reset token"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">New Password (Min 10 chars)</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '11px 16px' }}
            disabled={submitting}
          >
            {submitting ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
