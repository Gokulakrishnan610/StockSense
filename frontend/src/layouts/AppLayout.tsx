import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const COLLAPSED_KEY = 'stocksense.nav.collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!value));
      } catch {
        // Preference only; ignore storage failures.
      }
      return !value;
    });
  };

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`} style={{ display: 'flex', minHeight: '100vh' }}>
    <Sidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
    />
    <div className="app-content">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="app-main"><div className="page-container"><Outlet /></div></main>
    </div>
  </div>;
}
