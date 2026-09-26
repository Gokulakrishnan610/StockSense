import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  SlidersHorizontal,
  User,
  Warehouse,
  X,
} from '../components/ui/icons';
import { useAuth } from '../context/AuthContext';
import { useNavCounts, type NavCounts } from './useNavCounts';

type IconType = typeof Package;

interface NavEntry {
  label: string;
  path: string;
  Icon: IconType;
  count?: keyof NavCounts;
  /** Tooltip text explaining what the badge counts. */
  countHint?: string;
}

interface NavSection {
  title: string;
  collapsible?: boolean;
  items: NavEntry[];
}

const SECTIONS: NavSection[] = [
  { title: 'Overview', items: [{ label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard }] },
  {
    title: 'Inventory',
    items: [
      { label: 'Products', path: '/products', Icon: Package },
      { label: 'Categories', path: '/categories', Icon: FolderTree },
      { label: 'Reordering Rules', path: '/reordering-rules', Icon: Sliders },
    ],
  },
  {
    title: 'Operations',
    collapsible: true,
    items: [
      { label: 'Receipts', path: '/operations/receipts', Icon: ArrowDownToLine, count: 'receipts', countHint: 'open receipts' },
      { label: 'Deliveries', path: '/operations/deliveries', Icon: ArrowUpFromLine, count: 'deliveries', countHint: 'open deliveries' },
      { label: 'Internal Transfers', path: '/operations/transfers', Icon: ArrowLeftRight, count: 'transfers', countHint: 'open transfers' },
      { label: 'Inventory Adjustments', path: '/operations/adjustments', Icon: SlidersHorizontal, count: 'adjustments', countHint: 'draft adjustments' },
      { label: 'Move History', path: '/operations/move-history', Icon: History },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Warehouses', path: '/warehouses', Icon: Warehouse, count: 'warehouses', countHint: 'warehouses' },
      { label: 'Locations', path: '/locations', Icon: MapPin, count: 'locations', countHint: 'locations' },
    ],
  },
];

const OPERATIONS_OPEN_KEY = 'stocksense.nav.operationsOpen';

const readOperationsOpen = () => {
  try {
    return localStorage.getItem(OPERATIONS_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const counts = useNavCounts();
  const [operationsOpen, setOperationsOpen] = useState(readOperationsOpen);

  const toggleOperations = () => {
    setOperationsOpen((open) => {
      try {
        localStorage.setItem(OPERATIONS_OPEN_KEY, String(!open));
      } catch {
        // Preference only; ignore storage failures.
      }
      return !open;
    });
  };

  const renderItem = ({ label, path, Icon, count, countHint }: NavEntry) => {
    const value = count ? counts[count] : undefined;
    const showBadge = value !== undefined && value > 0;
    return (
      <NavLink
        key={path}
        to={path}
        onClick={onClose}
        title={collapsed ? (showBadge ? `${label} (${value} ${countHint})` : label) : undefined}
        aria-label={showBadge ? `${label}, ${value} ${countHint}` : undefined}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <Icon />
        <span className="nav-label">{label}</span>
        {showBadge && (
          <span className="nav-badge" title={`${value} ${countHint}`}>
            {value > 99 ? '99+' : value}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside
        id="app-navigation"
        className={`app-sidebar ${isOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      >
        <div className="sidebar-brand">
          <img src="/logo.png" alt="StockSense" className="sidebar-logo" />
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation">
            <X />
          </button>
        </div>

        <button
          className="sidebar-collapse-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {SECTIONS.map((section) => {
            const sectionActive = section.items.some((item) => pathname.startsWith(item.path));
            // Keep the group open while one of its pages is shown, and always in the icon rail.
            const expanded = !section.collapsible || collapsed || operationsOpen || sectionActive;
            const openCount = section.collapsible
              ? section.items.reduce((sum, item) => sum + (item.count ? counts[item.count] ?? 0 : 0), 0)
              : 0;
            return (
              <div key={section.title} className="nav-section">
                {section.collapsible ? (
                  <button
                    className={`nav-section-title nav-section-toggle ${sectionActive ? 'has-active' : ''}`}
                    onClick={toggleOperations}
                    aria-expanded={expanded}
                    disabled={sectionActive}
                    title={sectionActive ? 'Showing the current page' : undefined}
                  >
                    <span>{section.title}</span>
                    {!expanded && openCount > 0 && <span className="nav-badge">{openCount}</span>}
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <div className="nav-section-title">{section.title}</div>
                )}
                {expanded && (
                  <div className={`nav-group ${section.collapsible ? 'nav-group-nested' : ''}`}>
                    {section.items.map(renderItem)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/profile"
            onClick={onClose}
            title={collapsed ? 'Profile & Account' : undefined}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <User />
            <span className="nav-label">
              Profile & Account
              <span className="nav-sublabel">Settings & security</span>
            </span>
          </NavLink>
          <button
            className="nav-item"
            title={collapsed ? 'Logout' : undefined}
            onClick={async () => {
              await logout();
              navigate('/login');
              onClose();
            }}
          >
            <LogOut />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
