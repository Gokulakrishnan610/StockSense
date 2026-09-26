import React, { useEffect, useId, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export type SelectItem = SelectOption | SelectGroup;

function isGroup(item: SelectItem): item is SelectGroup {
  return 'options' in item;
}

interface SelectProps {
  /** Controlled value */
  value: string;
  onChange: (value: string) => void;
  /** Flat options or grouped options */
  options: SelectItem[];
  /** Shown when value === '' */
  placeholder?: string;
  disabled?: boolean;
  /** Filter-bar variant (smaller, pill-shaped) vs form variant (full width) */
  variant?: 'filter' | 'form';
  label?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** Flatten groups to find a label for the current value */
function labelFor(options: SelectItem[], value: string): string {
  for (const item of options) {
    if (isGroup(item)) {
      const found = item.options.find((o) => o.value === value);
      if (found) return found.label;
    } else {
      if (item.value === value) return item.label;
    }
  }
  return '';
}

/** All flat options in rendering order */
function flatOptions(options: SelectItem[]): SelectOption[] {
  const out: SelectOption[] = [];
  for (const item of options) {
    if (isGroup(item)) out.push(...item.options);
    else out.push(item);
  }
  return out;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  variant = 'form',
  label,
  id: providedId,
  'aria-label': ariaLabel,
  className,
}) => {
  const autoId = useId();
  const id = providedId ?? autoId;
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const flat = flatOptions(options);
  const currentLabel = value ? labelFor(options, value) : '';
  const isFilter = variant === 'filter';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLLIElement>('li[role="option"]');
    items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, open]);

  // Reset focus when opening
  useEffect(() => {
    if (!open) return;
    const idx = flat.findIndex((o) => o.value === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (focusedIndex >= 0) {
          select(flat[focusedIndex].value);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setFocusedIndex((i) => Math.min(i + 1, flat.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(flat.length - 1);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const triggerClass = [
    'ss-select-trigger',
    isFilter ? 'ss-select-filter' : 'ss-select-form',
    open ? 'ss-select-open' : '',
    disabled ? 'ss-select-disabled' : '',
    value ? 'ss-select-has-value' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  let listIdx = -1; // running index into flat[] across groups

  return (
    <div className={`ss-select-wrap ${isFilter ? 'ss-select-wrap-filter' : ''}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="ss-select-label">
          {label}
        </label>
      )}
      <div
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        className={triggerClass}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span className={`ss-select-value ${!value ? 'ss-select-placeholder' : ''}`}>
          {value ? currentLabel : placeholder}
        </span>
        <svg
          className={`ss-select-chevron ${open ? 'ss-select-chevron-up' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div className="ss-select-portal">
          <ul
            ref={listRef}
            role="listbox"
            aria-label={label ?? ariaLabel}
            className="ss-select-list"
          >
            {options.map((item) => {
              if (isGroup(item)) {
                return (
                  <li key={item.label} className="ss-select-group" role="presentation">
                    <div className="ss-select-group-label">{item.label}</div>
                    {item.options.map((opt) => {
                      listIdx++;
                      const thisIdx = listIdx;
                      return (
                        <li
                          key={opt.value}
                          role="option"
                          aria-selected={opt.value === value}
                          className={[
                            'ss-select-option',
                            'ss-select-option-indent',
                            opt.value === value ? 'ss-select-selected' : '',
                            thisIdx === focusedIndex ? 'ss-select-focused' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => select(opt.value)}
                          onMouseEnter={() => setFocusedIndex(thisIdx)}
                        >
                          {opt.value === value && (
                            <svg className="ss-select-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {opt.label}
                        </li>
                      );
                    })}
                  </li>
                );
              }
              listIdx++;
              const thisIdx = listIdx;
              return (
                <li
                  key={item.value}
                  role="option"
                  aria-selected={item.value === value}
                  className={[
                    'ss-select-option',
                    item.value === value ? 'ss-select-selected' : '',
                    thisIdx === focusedIndex ? 'ss-select-focused' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(item.value)}
                  onMouseEnter={() => setFocusedIndex(thisIdx)}
                >
                  {item.value === value && (
                    <svg className="ss-select-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {item.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
