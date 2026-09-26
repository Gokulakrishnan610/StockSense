import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from './icons';
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <div style={{ position: 'relative' }}>
    <input {...props} type={visible ? 'text' : 'password'} style={{ ...props.style, paddingRight: 40 }} />
    <button type="button" className="icon-button" aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(!visible)}
      style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  </div>;
}
