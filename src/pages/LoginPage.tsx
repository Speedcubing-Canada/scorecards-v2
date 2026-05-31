import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { CLIENT_ID } from '../auth/wca';
import LanguageSelect from '../components/LanguageSelect';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const missingClientId = !CLIENT_ID;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.langRow}>
          <LanguageSelect />
          <ThemeToggle />
        </div>

        <Logo style={styles.logo} />

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
    backgroundColor: 'var(--bg)',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: 12,
    padding: '48px 56px',
    maxWidth: 440,
    width: '100%',
    boxShadow: 'var(--shadow-lg)',
    textAlign: 'center',
  },
  langRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  logo: {
    height: 40,
    marginBottom: 24,
  },
  title: {
    margin: '0 0 10px',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '0 0 32px',
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  button: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-contrast)',
    border: 'none',
    borderRadius: 8,
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  warning: {
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-border)',
    borderRadius: 8,
    padding: '16px',
    fontSize: 13,
    textAlign: 'left',
    lineHeight: 1.7,
    color: 'var(--warning-text)',
  },
};
