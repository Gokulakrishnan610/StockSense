import { AuthLayout } from '../../layouts/AuthLayout';
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from '../../components/ui/icons';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const VerifyOTP: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const defaultEmail = (location.state as { email?: string })?.email || '';

  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp || otp.length !== 6) {
      setErrorMessage('Please provide a valid email and 6-digit numerical OTP code.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await api.verifyOtp(email.trim().toLowerCase(), otp.trim());
      showToast('success', 'OTP Verified', 'Challenge verified successfully. Proceed to reset password.');
      navigate('/reset-password', { state: { reset_token: res.reset_token } });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Invalid or expired OTP code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Enter OTP" description="Enter the 6-digit code sent to your email.">
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
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">6-Digit OTP</label>
            <input
              type="text"
              maxLength={6}
              className="form-input"
              placeholder="e.g. 123456"
              style={{ letterSpacing: '0.2em', fontSize: '1.125rem', textAlign: 'center', fontWeight: 600 }}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={submitting}
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '11px 16px' }}
            disabled={submitting}
          >
            {submitting ? 'Verifying Code...' : 'Verify OTP'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link
            to="/forgot-password"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Resend OTP
          </Link>
        </div>
    </AuthLayout>
  );
};
