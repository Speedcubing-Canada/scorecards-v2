import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { CLIENT_ID } from '../auth/wca';
import i18n from '../i18n/index';

const LANGS = ['en', 'fr', 'es'] as const;

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const missingClientId = !CLIENT_ID;
  const currentLang = (i18n.language?.slice(0, 2) ?? 'en') as typeof LANGS[number];

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.langRow}>
          {LANGS.map(lang => (
            <button
              key={lang}
              style={{ ...styles.langBtn, ...(currentLang === lang ? styles.langBtnActive : {}) }}
              onClick={() => i18n.changeLanguage(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        <h1 style={styles.title}>{t('common.app_title')}</h1>
        <p style={styles.subtitle}>{t('login.subtitle')}</p>

        {missingClientId ? (
          <div style={styles.warning}>
            <strong>{t('login.setup_required')}</strong>{' '}
            {t('login.setup_env_instruction', { key: 'VITE_WCA_CLIENT_ID' })}
            <br />
            <br />
            {t('login.setup_oauth_instruction')}{' '}
            <a href="https://www.worldcubeassociation.org/oauth/applications" target="_blank" rel="noreferrer">
              {t('login.setup_oauth_link')}
            </a>{' '}
            {t('login.setup_redirect_uri')} <code>{window.location.origin}/auth/callback</code>
          </div>
        ) : (
          <button style={styles.button} onClick={login}>
            {t('login.sign_in_button')}
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    fontFamily: 'Helvetica, Arial, sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '48px 56px',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  langRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 24,
  },
  langBtn: {
    background: '#f0f0f0',
    border: '1px solid #d0d0d0',
    color: '#666',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  langBtnActive: {
    background: '#003087',
    borderColor: '#003087',
    color: '#fff',
  },
  title: {
    margin: '0 0 12px',
    fontSize: 26,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '0 0 36px',
    fontSize: 15,
    color: '#555',
    lineHeight: 1.6,
  },
  button: {
    backgroundColor: '#003087',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  warning: {
    backgroundColor: '#fff8e1',
    border: '1px solid #f9a825',
    borderRadius: 8,
    padding: '16px',
    fontSize: 13,
    textAlign: 'left',
    lineHeight: 1.7,
    color: '#333',
  },
};
