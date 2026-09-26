import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Warehouse,
  MapPin,
  Sliders,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  History,
  ChevronDown,
  ChevronRight,
  X,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();

  const isOperationsActive = location.pathname.startsWith('/operations');
  const [operationsOpen, setOperationsOpen] = useState<boolean>(isOperationsActive);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Products', path: '/products', icon: <Package size={18} /> },
    { label: 'Categories', path: '/categories', icon: <FolderTree size={18} /> },
    { label: 'Warehouses', path: '/warehouses', icon: <Warehouse size={18} /> },
    { label: 'Locations', path: '/locations', icon: <MapPin size={18} /> },
    { label: 'Reordering Rules', path: '/reordering-rules', icon: <Sliders size={18} /> },
  ];

  const operationsItems = [
    { label: 'Receipts', path: '/operations/receipts', icon: <ArrowDownLeft size={16} /> },
    { label: 'Delivery Orders', path: '/operations/deliveries', icon: <ArrowUpRight size={16} /> },
    { label: 'Inventory Adjustment', path: '/operations/adjustments', icon: <RefreshCw size={16} /> },
    { label: 'Move History', path: '/operations/move-history', icon: <History size={16} /> },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 40,
          }}
        />
      )}

      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '260px',
          backgroundColor: 'var(--surface-sidebar)',
          borderRight: '1px solid var(--border-color)',
          zIndex: 45,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.25s ease-in-out',
          transform: isOpen || window.innerWidth > 768 ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '64px',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
              }}
            >
              <Boxes size={20} />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: '#fff' }}>
                StockSense
              </span>
              <span style={{ fontSize: '0.6875rem', display: 'block', color: 'var(--text-muted)', lineHeight: 1 }}>
                Inventory Platform
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: window.innerWidth <= 768 ? 'block' : 'none',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation List */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 8px 12px' }}>
            Main Menu
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    backgroundColor: active ? 'var(--color-primary-light)' : 'transparent',
                    borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              );
            })}

            {/* Operations Dropdown */}
            <div>
              <button
                onClick={() => setOperationsOpen(!operationsOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: isOperationsActive ? 600 : 500,
                  color: isOperationsActive ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isOperationsActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Boxes size={18} style={{ color: isOperationsActive ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                  <span>Operations</span>
                </div>
                {operationsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {operationsOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '28px', marginTop: '4px' }}>
                  {operationsItems.map((op) => {
                    const active = location.pathname === op.path;
                    return (
                      <NavLink
                        key={op.path}
                        to={op.path}
                        onClick={onClose}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: active ? 600 : 400,
                          color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                          backgroundColor: active ? 'var(--color-primary-light)' : 'transparent',
                          textDecoration: 'none',
                        }}
                      >
                        {op.icon}
                        {op.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>

            <NavLink
              to="/profile"
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: location.pathname === '/profile' ? 600 : 500,
                color: location.pathname === '/profile' ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: location.pathname === '/profile' ? 'var(--color-primary-light)' : 'transparent',
                borderLeft: location.pathname === '/profile' ? '3px solid var(--color-primary)' : '3px solid transparent',
                textDecoration: 'none',
                marginTop: '8px',
              }}
            >
              <User size={18} style={{ color: location.pathname === '/profile' ? 'var(--color-primary)' : 'var(--text-muted)' }} />
              Profile & Settings
            </NavLink>
          </div>
        </nav>

        {/* Footer User Badge */}
        {user && (
          <div
            style={{
              padding: '14px 16px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: '#fff',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: '0.7188rem', color: 'var(--text-muted)' }}>
                  {user.role === 'INVENTORY_MANAGER' ? 'Manager' : 'Staff'}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
