import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      navigate(`/?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!code || !state) {
      navigate('/?error=missing_params', { replace: true });
      return;
    }

    handleCallback(code, state)
      .then(() => navigate('/competitions', { replace: true }))
      .catch((err) => navigate(`/?error=${encodeURIComponent(err.message)}`, { replace: true }));
  }, [handleCallback, navigate]);

  return (
    <div style={styles.container}>
      <p style={styles.text}>{t('auth_callback.signing_in')}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Helvetica, Arial, sans-serif',
  },
  text: {
    fontSize: 18,
    color: 'var(--text-muted)',
  },
};
