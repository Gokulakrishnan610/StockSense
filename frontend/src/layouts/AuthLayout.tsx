import type { ReactNode } from 'react';
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <main className="auth-layout">
    <div className="auth-brand">
      <img src="/logo.png" alt="StockSense" className="auth-logo" />
    </div>
    <section className="auth-card" aria-label={title}><h1>{title}</h1>{description && <p className="auth-description">{description}</p>}{children}</section>
  </main>;
}
