import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div style={{ display: 'flex', minHeight: '100vh' }}>
    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="app-content">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="app-main"><div className="page-container"><Outlet /></div></main>
    </div>
  </div>;
}
