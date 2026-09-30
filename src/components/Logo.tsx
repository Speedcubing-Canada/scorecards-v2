import { useTheme } from '../theme/ThemeContext';

/**
 * Speedcubing Canada logo. Swaps to a white-wordmark variant in dark mode so the
 * black text/lines stay legible against the dark background.
 *
 * width/height are the SVG's intrinsic ratio, so the box is reserved before the file
 * loads; callers size it with CSS and the other axis follows.
 */
export default function Logo({ className }: { className?: string }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/scc-logo-dark.svg' : '/scc-logo.svg';
  return <img src={src} alt="Speedcubing Canada" width={290} height={100} className={className} />;
}
