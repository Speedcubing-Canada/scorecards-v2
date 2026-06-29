import type { ReactNode } from 'react';

/** Amber notice box, matching the login-page setup warning. Used for the "no groups
 *  assigned yet" message on the Settings and Generate pages. */
export default function WarningBanner({ children }: { children: ReactNode }) {
  return <div style={style}>{children}</div>;
}

const style: React.CSSProperties = {
  backgroundColor: 'var(--warning-bg)',
  border: '1px solid var(--warning-border)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 16px',
  fontSize: 'var(--fs-label)',
  textAlign: 'left',
  lineHeight: 1.6,
  color: 'var(--warning-text)',
  marginBottom: 20,
};
