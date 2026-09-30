import { useId, useState } from 'react';
import s from './Tooltip.module.css';

/**
 * Lightweight tooltip for jargon and icon-only controls. Shows on hover or keyboard focus.
 * The wrapper is inline-flex so it doesn't disturb layout; the bubble sits above (default)
 * or below the trigger and is linked to it via aria-describedby.
 */
export default function Tooltip({
  label,
  children,
  placement = 'top',
}: {
  label: string;
  children: React.ReactNode;
  placement?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={s.wrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span id={id} role="tooltip" className={`${s.bubble} ${s[placement]}`}>
          {label}
        </span>
      )}
    </span>
  );
}
