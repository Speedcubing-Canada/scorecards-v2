import { useId, useState } from 'react';

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

  const bubble: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    [placement === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
    zIndex: 200,
    maxWidth: 240,
    width: 'max-content',
    padding: '6px 9px',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-lg)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 400,
    lineHeight: 1.4,
    textAlign: 'left',
    pointerEvents: 'none',
    whiteSpace: 'normal',
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span id={id} role="tooltip" style={bubble}>
          {label}
        </span>
      )}
    </span>
  );
}
