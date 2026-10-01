import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import Tooltip from './Tooltip';
import s from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = t(isDark ? 'common.theme_light' : 'common.theme_dark');

  return (
    <Tooltip label={label} placement="bottom">
      <button className={s.btn} onClick={toggleTheme} aria-label={label}>
        {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
    </Tooltip>
  );
}
