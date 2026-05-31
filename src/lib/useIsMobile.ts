import { useEffect, useState } from 'react';

/**
 * Single source of truth for the phone breakpoint. At or below this width
 * (in CSS pixels) the app switches to its mobile layout. Mirrors the
 * `(max-width: 600px)` media query used by {@link useIsMobile}.
 */
export const MOBILE_BREAKPOINT = 600;

/** Pure breakpoint test, extracted so it can be unit-tested without a DOM. */
export function isMobileWidth(width: number): boolean {
  return width <= MOBILE_BREAKPOINT;
}

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

/**
 * Returns `true` when the viewport is at or below {@link MOBILE_BREAKPOINT}.
 * Backed by `window.matchMedia` so it updates live as the window resizes.
 *
 * Because every component in this app styles itself with inline
 * `React.CSSProperties` objects (no CSS classes), CSS media queries can't
 * override those styles — so the breakpoint has to be read in JS and used to
 * pick between style objects.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
