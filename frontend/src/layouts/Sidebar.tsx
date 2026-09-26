import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, FolderTree, Warehouse, MapPin, Sliders, Boxes,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RefreshCw, History, X, User, LogOut } from '../components/ui/icons';
import { useAuth } from '../context/AuthContext';

const items = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { label: 'Products', path: '/products', Icon: Package },
  { label: 'Categories', path: '/categories', Icon: FolderTree },
  { label: 'Warehouses', path: '/warehouses', Icon: Warehouse },
  { label: 'Locations', path: '/locations', Icon: MapPin },
  { label: 'Reordering Rules', path: '/reordering-rules', Icon: Sliders },
  { label: 'Receipts', path: '/operations/receipts', Icon: ArrowDownLeft },
  { label: 'Delivery Orders', path: '/operations/deliveries', Icon: ArrowUpRight },
  { label: 'Internal Transfers', path: '/operations/transfers', Icon: ArrowLeftRight },
  { label: 'Adjustments', path: '/operations/adjustments', Icon: RefreshCw },
  { label: 'Stock Ledger', path: '/operations/move-history', Icon: History },
];
export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return <>
    {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
    <aside id="app-navigation" className={`app-sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-brand brand">
        <Boxes size={20} /><span>StockSense</span>
        <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation"><X /></button>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map(({ label, path, Icon }) => <NavLink key={path} to={path} onClick={onClose}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon />{label}</NavLink>)}
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/profile" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><User />Profile</NavLink>
        <button className="nav-item" onClick={async () => { await logout(); navigate('/login'); onClose(); }}><LogOut />Logout</button>
      </div>
    </aside>
  </>;
}
