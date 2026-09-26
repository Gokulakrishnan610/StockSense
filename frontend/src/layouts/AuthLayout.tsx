import type { ReactNode } from 'react';
import { Boxes } from '../components/ui/icons';
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <main className="auth-layout">
    <div className="auth-brand"><div className="brand"><Boxes size={24} /><span>StockSense</span></div><p>Inventory Management System</p></div>
    <section className="auth-card" aria-label={title}><h1>{title}</h1>{description && <p className="auth-description">{description}</p>}{children}</section>
  </main>;
}
