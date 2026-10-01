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
 * Styling is not what this is for: a `(max-width: 600px)` media query in the
 * component's CSS module handles that, and costs no render. Reach for this hook
 * only when the breakpoint picks a different subtree or component - the Header's
 * hamburger menu, or PrintGuide's down-vs-right arrow.
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
