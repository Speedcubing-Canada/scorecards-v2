import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { WCA_API_URL } from '../auth/wca';
import { useIsMobile } from '../lib/useIsMobile';
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
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Close the menu on a click/tap outside the header.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  const userInfo = showUser && user && (
    <>
      <img
        src={`${WCA_API_URL}/users/${user.id}/avatar/thumb`}
        alt=""
        style={s.avatar}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <span style={s.userName}>{user.name}</span>
    </>
  );

  return (
    <header ref={headerRef} style={{ ...s.header, ...(isMobile ? s.headerMobile : {}) }}>
      <div style={s.left}>
        <Logo style={s.logo} />
        <div style={s.divider} />
        {showBack ? (
          <button style={s.back} onClick={onBack}>{t('common.back')}</button>
        ) : (
          <span style={s.title}>{t('common.app_title')}</span>
        )}
      </div>

      {isMobile ? (
        <>
          <button
            style={s.hamburger}
            aria-label={t('common.menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {menuOpen && (
            <div style={s.menuPanel}>
              <div style={s.menuRow}>
                <LanguageSelect />
                <ThemeToggle />
              </div>
              {userInfo && <div style={s.menuUser}>{userInfo}</div>}
              {showSignOut && (
                <button
                  style={s.menuSignOut}
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  {t('common.sign_out')}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={s.right}>
          <LanguageSelect />
          <ThemeToggle />
          {userInfo}
          {showSignOut && (
            <button style={s.logoutBtn} onClick={logout}>
              {t('common.sign_out')}
            </button>
          )}
        </div>
      )}
    </header>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    position: 'relative',
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
  headerMobile: { padding: '0 16px' },
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
  hamburger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    padding: 0,
  },
  menuPanel: {
    position: 'absolute',
    top: 56,
    right: 12,
    minWidth: 200,
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-lg)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    zIndex: 50,
  },
  menuRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  menuUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  },
  menuSignOut: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-muted)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
};
