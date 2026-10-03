import type { ReactNode } from 'react';
import s from './WarningBanner.module.css';

/** Amber notice box, matching the login-page setup warning. `info` is the blue variant, for
 *  notices that are not a problem (on-the-spot registration). */
export default function WarningBanner({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'info' }) {
  return <div className={`${s.banner} ${tone === 'info' ? s.info : ''}`}>{children}</div>;
}
