import React from 'react';

export const KpiCard: React.FC<{
  label: string;
  tag: string;
  tone: 'neutral' | 'warning' | 'danger' | 'info' | 'primary';
  value: number;
  hint: string;
  icon: React.ReactNode;
  onClick?: () => void;
}> = ({ label, tag, tone, value, hint, icon, onClick }) => (
  <button type="button" className={`dash-kpi tone-${tone}`} onClick={onClick} disabled={!onClick}>
    <div className="dash-kpi-top">
      <span className="dash-kpi-label" title={label}>{label}</span>
      <span className="dash-tag">{tag}</span>
    </div>
    <div className="dash-kpi-value">
      <span>{value.toLocaleString()}</span>
      <span className="dash-kpi-icon">{icon}</span>
    </div>
    <div className="dash-kpi-hint">{hint}</div>
  </button>
);

export const PanelHeader: React.FC<{
  title: string;
  dot?: 'warning' | 'success' | 'muted' | 'primary';
  badge?: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
}> = ({ title, dot = 'primary', badge, subtitle, children }) => (
  <div className="panel-header">
    <div className="panel-title">
      <span className={`dot dot-${dot}`} aria-hidden="true" />
      <h3>{title}</h3>
      {badge !== undefined && <span className="dash-count">{badge}</span>}
      {subtitle && <span className="panel-subtitle">{subtitle}</span>}
    </div>
    {children && <div className="panel-actions">{children}</div>}
  </div>
);
