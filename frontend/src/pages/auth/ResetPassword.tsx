import { PasswordInput } from '../../components/ui/PasswordInput';
import { AuthLayout } from '../../layouts/AuthLayout';
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from '../../components/ui/icons';
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
    <AuthLayout title="Create new password" description="Enter your new password below.">
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
            <PasswordInput
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
            <PasswordInput
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
    </AuthLayout>
  );
};
