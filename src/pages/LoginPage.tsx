import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { CLIENT_ID } from '../auth/wca';
import LanguageSelect from '../components/LanguageSelect';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import AboutDialog from '../components/AboutDialog';
import { useIsMobile } from '../lib/useIsMobile';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, authError } = useAuth();
  const isMobile = useIsMobile();
  const [params] = useSearchParams();
  const missingClientId = !CLIENT_ID;
  // Raw OAuth codes mean nothing to an organizer, so only the distinction they can act on
  // survives: renewal gave up, versus the sign-in itself did not finish.
  const failure = authError ?? (params.get('error') ? 'sign_in_failed' : null);

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
        <div style={styles.langRow}>
          <LanguageSelect />
          <ThemeToggle />
        </div>

        <Logo style={styles.logo} />

        <h1 style={styles.title}>{t('common.app_title')}</h1>
        <p style={styles.subtitle}>{t('login.subtitle')}</p>

        {failure && (
          <div role="alert" style={styles.error}>
            {t(failure === 'session_expired' ? 'errors.session_expired' : 'errors.sign_in_failed')}
          </div>
        )}

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

        <div style={styles.aboutRow}>
          <AboutDialog as="text" />
        </div>
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
    borderRadius: 'var(--radius-lg)',
    padding: '48px 56px',
    maxWidth: 440,
    width: '100%',
    boxShadow: 'var(--shadow-lg)',
    textAlign: 'center',
  },
  cardMobile: { padding: '32px 20px' },
  aboutRow: { marginTop: 20, textAlign: 'center' },
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
    fontSize: 'var(--fs-display)',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '0 0 32px',
    fontSize: 'var(--fs-body)',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  button: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-contrast)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '14px 32px',
    fontSize: 'var(--fs-heading)',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  error: {
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    marginBottom: 24,
    fontSize: 'var(--fs-label)',
    textAlign: 'left',
    lineHeight: 1.6,
    color: 'var(--warning-text)',
  },
  warning: {
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    fontSize: 'var(--fs-label)',
    textAlign: 'left',
    lineHeight: 1.7,
    color: 'var(--warning-text)',
  },
};
