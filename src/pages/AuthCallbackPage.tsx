import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { STORAGE_RETURN, useAuth } from '../auth/useAuth';
import s from './AuthCallbackPage.module.css';

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

    // A renewal stashes where the organizer was, so the wizard resumes instead of restarting.
    const back = sessionStorage.getItem(STORAGE_RETURN);
    sessionStorage.removeItem(STORAGE_RETURN);

    handleCallback(code, state)
      .then(() => navigate(back || '/competitions', { replace: true }))
      .catch((err) => navigate(`/?error=${encodeURIComponent(err.message)}`, { replace: true }));
  }, [handleCallback, navigate]);

  return (
    <div className={s.container}>
      <p className={s.text}>{t('auth_callback.signing_in')}</p>
    </div>
  );
}
