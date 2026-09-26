import React from 'react';
import { Select } from './Select';

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
  const items = allLabel
    ? [{ value: '', label: allLabel }, ...options]
    : options;

  return (
    <Select
      variant="filter"
      label={label}
      value={value}
      onChange={onChange}
      options={items}
      placeholder={allLabel || 'All'}
      disabled={disabled}
    />
  );
};
