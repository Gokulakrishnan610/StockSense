import React from 'react';
import { Check, Copy, Printer } from '../../components/ui/icons';
import { useToast } from '../../context/ToastContext';
import type { OperationStatusCode } from '../../types';
import { formatDateTime } from './operationUtils';

/** Reference code with a copy-to-clipboard button. */
export const CopyRef: React.FC<{ value: string }> = ({ value }) => {
  const { showToast } = useToast();
  return (
    <span className="copy-ref">
      <span className="code-chip">{value}</span>
      <button
        type="button"
        className="icon-button"
        title="Copy reference"
        aria-label={`Copy reference ${value}`}
        onClick={() =>
          navigator.clipboard
            ?.writeText(value)
            .then(() => showToast('info', 'Reference copied', value))
            .catch(() => showToast('error', 'Could not copy', 'Copy the reference manually.'))
        }
      >
        <Copy size={14} />
      </button>
    </span>
  );
};

export const PrintButton: React.FC<{ label?: string }> = ({ label = 'Print Slip' }) => (
  <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
    <Printer size={16} /> {label}
  </button>
);

/** Numbered progress stepper; Canceled documents show the steps greyed out. */
export const Stepper: React.FC<{
  steps: Array<{ status: OperationStatusCode; label: string }>;
  current: OperationStatusCode;
}> = ({ steps, current }) => {
  const canceled = current === 'CANCELED';
  const index = steps.findIndex((s) => s.status === current);
  return (
    <ol className={`stepper ${canceled ? 'is-canceled' : ''}`} aria-label="Progress">
      {steps.map((step, i) => {
        const done = !canceled && (i < index || current === 'DONE');
        const active = !canceled && i === index && current !== 'DONE';
        return (
          <li key={step.status} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`} aria-current={active ? 'step' : undefined}>
            <span className="step-dot">{done ? <Check size={14} /> : i + 1}</span>
            <span className="step-label">{step.label}</span>
          </li>
        );
      })}
      {canceled && <li className="step-canceled">Canceled</li>}
    </ol>
  );
};

export interface ActivityEvent {
  key: string;
  at: string;
  title: string;
  detail?: string;
  tone?: 'success' | 'danger' | 'neutral';
}

export const ActivityTrail: React.FC<{ events: ActivityEvent[] }> = ({ events }) => (
  <ol className="activity">
    {events.map((event) => (
      <li key={event.key} className={`tone-${event.tone ?? 'neutral'}`}>
        <span className="activity-dot" aria-hidden="true" />
        <div className="activity-body">
          <div className="activity-title">{event.title}</div>
          {event.detail && <div className="cell-sub">{event.detail}</div>}
        </div>
        <time className="mono activity-time" dateTime={event.at}>{formatDateTime(event.at)}</time>
      </li>
    ))}
  </ol>
);

export interface SlipLine {
  sku: string;
  name: string;
  from?: string;
  to?: string;
  quantity: string;
}

/**
 * Printable document slip. Hidden on screen; the print stylesheet shows only
 * this element when the user prints the page.
 */
export const PrintSlip: React.FC<{
  title: string;
  reference: string;
  status: string;
  meta: Array<{ label: string; value: string }>;
  lines: SlipLine[];
  showFrom: boolean;
  showTo: boolean;
  notes?: string;
  signatures: string[];
}> = ({ title, reference, status, meta, lines, showFrom, showTo, notes, signatures }) => (
  <section className="print-slip" aria-hidden="true">
    <header className="slip-header">
      <img src="/logo.png" alt="" className="slip-logo" />
      <div className="slip-title">
        <h1>{title}</h1>
        <div className="slip-ref">{reference}</div>
      </div>
      <div className="slip-status">{status}</div>
    </header>
    <dl className="slip-meta">
      {meta.map((m) => (
        <div key={m.label}>
          <dt>{m.label}</dt>
          <dd>{m.value || '—'}</dd>
        </div>
      ))}
      <div>
        <dt>Printed</dt>
        <dd>{formatDateTime(new Date().toISOString())}</dd>
      </div>
    </dl>
    <table className="slip-table">
      <thead>
        <tr>
          <th>#</th>
          <th>SKU</th>
          <th>Product</th>
          {showFrom && <th>From</th>}
          {showTo && <th>To</th>}
          <th className="num">Quantity</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={`${line.sku}-${i}`}>
            <td>{i + 1}</td>
            <td>{line.sku}</td>
            <td>{line.name}</td>
            {showFrom && <td>{line.from}</td>}
            {showTo && <td>{line.to}</td>}
            <td className="num">{line.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {notes && (
      <div className="slip-notes">
        <strong>Notes:</strong> {notes}
      </div>
    )}
    <div className="slip-signatures">
      {signatures.map((s) => (
        <div key={s}>
          <div className="slip-sign-line" />
          <span>{s}</span>
        </div>
      ))}
    </div>
    <footer className="slip-footer">Generated by StockSense Inventory Management</footer>
  </section>
);
