import type { ReactNode } from 'react';
import s from './WarningBanner.module.css';

/** Amber notice box, matching the login-page setup warning. Used for the "no groups
 *  assigned yet" message on the Settings and Generate pages. */
export default function WarningBanner({ children }: { children: ReactNode }) {
  return <div className={s.banner}>{children}</div>;
}
