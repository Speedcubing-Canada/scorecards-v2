import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import Tooltip from './Tooltip';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip label={label} placement="bottom">
      <button style={s.btn} onClick={toggleTheme} aria-label={label}>
        {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
    </Tooltip>
  );
}

const s: Record<string, React.CSSProperties> = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 28,
    padding: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
