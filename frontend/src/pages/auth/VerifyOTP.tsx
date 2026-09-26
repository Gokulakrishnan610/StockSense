import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';
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
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            Verify OTP Code
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Enter the 6-digit code sent to your email address
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
      </div>
    </div>
  );
};
