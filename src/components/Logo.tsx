import { useTheme } from '../theme/ThemeContext';

/**
 * Speedcubing Canada logo. Swaps to a white-wordmark variant in dark mode so the
 * black text/lines stay legible against the dark background.
 */
export default function Logo({ style }: { style?: React.CSSProperties }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/scc-logo-dark.svg' : '/scc-logo.svg';
  return <img src={src} alt="Speedcubing Canada" style={style} />;
}
