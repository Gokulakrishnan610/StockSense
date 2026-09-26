import React from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  disabled?: boolean;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
  disabled = false,
}) => {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '8px 32px 8px 12px',
          fontSize: '0.875rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--surface-input)',
          color: 'var(--text-primary)',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minWidth: '140px',
        }}
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
