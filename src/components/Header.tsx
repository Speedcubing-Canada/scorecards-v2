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
    backgroundColor: '#003087',
    color: '#fff',
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { display: 'flex', alignItems: 'center' },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: 700 },
  back: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    cursor: 'pointer',
  },
  langBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 4,
    padding: '3px 7px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  langBtnActive: {
    background: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.7)',
    color: '#fff',
  },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' },
  userName: { fontSize: 14 },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    cursor: 'pointer',
  },
};
