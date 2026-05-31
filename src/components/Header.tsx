import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { WCA_API_URL } from '../auth/wca';
import LanguageSelect from './LanguageSelect';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

interface HeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showUser?: boolean;
  showSignOut?: boolean;
}

export default function Header({ showBack, onBack, showUser, showSignOut = true }: HeaderProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <header style={s.header}>
      <div style={s.left}>
        <Logo style={s.logo} />
        <div style={s.divider} />
        {showBack ? (
          <button style={s.back} onClick={onBack}>{t('common.back')}</button>
        ) : (
          <span style={s.title}>{t('common.app_title')}</span>
        )}
      </div>

      <div style={s.right}>
        <LanguageSelect />
        <ThemeToggle />

        {showUser && user && (
          <>
            <img
              src={`${WCA_API_URL}/users/${user.id}/avatar/thumb`}
              alt=""
              style={s.avatar}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <span style={s.userName}>{user.name}</span>
          </>
        )}

        {showSignOut && (
          <button style={s.logoutBtn} onClick={logout}>
            {t('common.sign_out')}
          </button>
        )}
      </div>
    </header>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    backgroundColor: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)',
  },
  left: { display: 'flex', alignItems: 'center', gap: 12 },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: { height: 26, display: 'block' },
  divider: { width: 1, height: 22, backgroundColor: 'var(--border)' },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  back: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-muted)',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' },
  userName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-muted)',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
