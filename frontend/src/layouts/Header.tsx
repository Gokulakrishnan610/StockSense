import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useToast } from '../context/ToastContext';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      showToast('info', 'Logged out', 'You have been logged out successfully.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const getPageTitle = (path: string): string => {
    if (path.startsWith('/dashboard')) return 'Inventory Dashboard';
    if (path.startsWith('/products')) return 'Product Catalog';
    if (path.startsWith('/categories')) return 'Product Categories';
    if (path.startsWith('/warehouses')) return 'Warehouses';
    if (path.startsWith('/locations')) return 'Locations';
    if (path.startsWith('/reordering-rules')) return 'Reordering Rules';
    if (path.startsWith('/operations/receipts')) return 'Operations / Receipts';
    if (path.startsWith('/operations/deliveries')) return 'Operations / Delivery Orders';
    if (path.startsWith('/operations/adjustments')) return 'Operations / Inventory Adjustments';
    if (path.startsWith('/operations/move-history')) return 'Operations / Move History';
    if (path.startsWith('/profile')) return 'User Profile';
    return 'StockSense IMS';
  };

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--surface-header)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onMenuToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Menu size={20} />
        </button>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          {getPageTitle(location.pathname)}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              onClick={() => navigate('/profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
                transition: 'background-color 0.15s ease',
              }}
              className="table-row-hover"
            >
              <UserIcon size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {user.name}
              </span>
              <StatusBadge status={user.role} />
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
              }}
              title="Logout from StockSense"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
