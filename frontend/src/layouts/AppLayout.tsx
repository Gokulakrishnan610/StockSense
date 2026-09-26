import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: window.innerWidth > 768 ? '260px' : 0,
          transition: 'margin-left 0.25s ease-in-out',
        }}
      >
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        <main style={{ flex: 1, padding: '24px 28px', backgroundColor: 'var(--bg-app)' }}>
          <div className="page-container" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
