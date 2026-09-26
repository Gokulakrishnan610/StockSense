import React from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { User, Mail, Shield, Key, LogOut } from '../components/ui/icons';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout();
      showToast('info', 'Logged Out', 'You have been logged out.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Account Profile</h2>
          <p className="page-subtitle">Authenticated user credentials and system role</p>
        </div>
      </div>

      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1.75rem',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusBadge status={user.role} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {user.role === 'INVENTORY_MANAGER' ? 'Full Inventory Catalog Admin' : 'Warehouse Operational Staff'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Login ID</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.login_id}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mail size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email Address</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.email}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>User Role</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.role}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Key size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>User Account UUID</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {user.id}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={16} /> Sign Out of StockSense
          </button>
        </div>
      </div>
    </div>
  );
};
