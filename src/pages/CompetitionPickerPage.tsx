import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { fetchErrorKey, fetchManagedCompetitions, isExpired } from '../auth/wca';
import type { WCACompetition } from '../types/wcif';
import Header from '../components/Header';
import AboutDialog from '../components/AboutDialog';
import Skeleton from '../components/Skeleton';
import { useIsMobile } from '../lib/useIsMobile';
import { visibleCompetitions } from '../lib/competitionList';
import { clearCustom, clearDownstream, readCompetition, writeCompetition } from '../lib/flowState';
import { clearPresetSettings } from '../presets';

export default function CompetitionPickerPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  function retry() {
    setError(null);
    setIsLoading(true);
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    // An expired token is already being renewed: hold the skeleton rather than spend the
    // request on a guaranteed 401. The fresh token re-runs this effect.
    if (!token || isExpired(token)) return;
    let cancelled = false;

    fetchManagedCompetitions(token.access_token)
      .then((data) => {
        if (cancelled) return;
        // Past competitions are kept in dev: off-season they are the only real WCIF to test with.
        setCompetitions(
          visibleCompetitions(data, new Date().toLocaleDateString('en-CA'), import.meta.env.DEV)
        );
        // A renewal re-runs this with a fresh token: drop the error the dead one produced.
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [token, attempt]);

  function selectCompetition(comp: WCACompetition) {
    // Drop any stale custom-competition state so it never leaks into a WCA flow.
    clearCustom();
    // A different competition starts over: the later steps restore what was picked before, and
    // must not hand the previous competition's scope, rounds and settings to this one.
    if (readCompetition().id !== comp.id) {
      clearDownstream();
      clearPresetSettings();
    }
    writeCompetition(comp.id, comp.name);
    navigate('/scope');
  }

  return (
    <div style={styles.container}>
      <Header showUser showSignOut />

      <main style={{ ...styles.main, ...(isMobile ? styles.mainMobile : {}) }}>
        <div style={styles.headingRow}>
          <h2 style={styles.heading}>{t('picker.heading')}</h2>
          <AboutDialog />
        </div>
        <p style={styles.hint}>{t('picker.hint')}</p>

        {isLoading && (
          <div role="status" aria-label={t('picker.loading')} style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={styles.compCard}>
                <Skeleton width="75%" height={16} />
                <Skeleton width="50%" height={13} />
              </div>
            ))}
          </div>
        )}
        {error != null && (
          <div style={styles.errorBox}>
            <p style={{ ...styles.status, color: 'var(--danger)', padding: 0 }}>
              {t(fetchErrorKey(error) === 'errors.session_expired'
                ? 'errors.session_expired'
                : 'errors.competitions_failed')}
            </p>
            <button style={styles.retryButton} onClick={retry}>
              {t('errors.retry')}
            </button>
          </div>
        )}

        {!isLoading && error == null && competitions.length === 0 && (
          <p style={styles.status}>{t('picker.empty')}</p>
        )}

        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
          {competitions.map((comp) => (
            <button
              key={comp.id}
              style={styles.compCard}
              onClick={() => selectCompetition(comp)}
            >
              <span style={styles.compName}>{comp.name}</span>
              <span style={styles.compMeta}>
                {comp.city} · {formatDate(comp.start_date)}
              </span>
            </button>
          ))}
        </div>

        {/* Niche flow: keep it discoverable but secondary, below the WCA list. It skips
            /scope, where a preset is otherwise re-written, so clear the seed on the way in. */}
        {!isLoading && (
          <button style={styles.customCard} onClick={() => { clearPresetSettings(); navigate('/custom'); }}>
            <span style={styles.customCardTitle}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              {t('picker.create_custom_title')}
            </span>
            <span style={styles.compMeta}>{t('picker.create_custom_desc')}</span>
          </button>
        )}
      </main>
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg)',
  },
  main: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '40px 24px',
  },
  mainMobile: { padding: '24px 16px' },
  headingRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  heading: { margin: 0, fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--text)' },
  hint: { margin: '0 0 28px', fontSize: 'var(--fs-body)', color: 'var(--text-muted)' },
  errorBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0',
  },
  retryButton: {
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 20px',
    fontSize: 'var(--fs-label)',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  status: { fontSize: 'var(--fs-heading)', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  gridMobile: { gridTemplateColumns: '1fr' },
  compCard: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  compName: { fontSize: 16, fontWeight: 700, color: 'var(--text)' },
  compMeta: { fontSize: 'var(--fs-label)', color: 'var(--text-muted)' },
  customCard: {
    backgroundColor: 'var(--surface)',
    border: '2px dashed var(--border-strong)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 20px',
    marginTop: 16,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  customCardTitle: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 16, fontWeight: 700, color: 'var(--text)',
  },
};
