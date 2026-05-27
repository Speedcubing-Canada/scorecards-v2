import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { WCA_API_URL } from '../auth/wca';
import i18n from '../i18n/index';

interface HeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showUser?: boolean;
  showSignOut?: boolean;
}

const LANGS = ['en', 'fr', 'es'] as const;
type UILang = typeof LANGS[number];

export default function Header({ showBack, onBack, showUser, showSignOut = true }: HeaderProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const currentLang = (i18n.language?.slice(0, 2) ?? 'en') as UILang;

  return (
    <header style={s.header}>
      <div style={s.left}>
        <img src="/scc-logo.svg" alt="Speedcubing Canada" style={s.logo} />
        <div style={s.divider} />
        {showBack ? (
          <button style={s.back} onClick={onBack}>{t('common.back')}</button>
        ) : (
          <span style={s.title}>{t('common.app_title')}</span>
        )}
      </div>

      <div style={s.right}>
        {LANGS.map(lang => (
          <button
            key={lang}
            style={{ ...s.langBtn, ...(currentLang === lang ? s.langBtnActive : {}) }}
            onClick={() => i18n.changeLanguage(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}

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
    backgroundColor: '#fff',
    borderBottom: '1px solid #e8e8e8',
    color: '#1a1a1a',
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  left: { display: 'flex', alignItems: 'center', gap: 12 },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: { height: 26, display: 'block' },
  divider: { width: 1, height: 22, backgroundColor: '#e0e0e0' },
  title: { fontSize: 13, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.01em' },
  back: {
    background: 'none',
    border: '1px solid #ccc',
    color: '#444',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  langBtn: {
    background: 'none',
    border: '1px solid #ddd',
    color: '#999',
    borderRadius: 4,
    padding: '3px 7px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    fontFamily: 'inherit',
  },
  langBtnActive: {
    background: '#ffebee',
    borderColor: '#d32f2f',
    color: '#d32f2f',
  },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' },
  userName: { fontSize: 13, fontWeight: 500, color: '#1a1a1a' },
  logoutBtn: {
    background: 'none',
    border: '1px solid #ccc',
    color: '#444',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
