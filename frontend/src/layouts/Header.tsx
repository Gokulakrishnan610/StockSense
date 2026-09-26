import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search } from '../components/ui/icons';
import { useAuth } from '../context/AuthContext';
import { Breadcrumbs } from './Breadcrumbs';

export function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  return <header className="app-header">
    <button className="icon-button mobile-toggle" onClick={onMenuToggle} aria-label="Toggle navigation" aria-controls="app-navigation"><Menu size={20} /></button>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0, flex: 1 }}>
    <Breadcrumbs />
    <form className="header-search" role="search" onSubmit={(event) => {
      event.preventDefault(); navigate(`/products?search=${encodeURIComponent(search.trim())}`);
    }}>
      <Search size={14} />
      <input aria-label="Search products" placeholder="Search products by name or SKU…" value={search} onChange={event => setSearch(event.target.value)} />
    </form>
    </div>
    {user && <Link to="/profile" className="header-profile">
      <span className="avatar">{user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
      <span className="profile-copy">{user.name}<span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11 }}>{user.role === 'INVENTORY_MANAGER' ? 'Inventory Manager' : 'Warehouse Staff'}</span></span>
    </Link>}
  </header>;
}
