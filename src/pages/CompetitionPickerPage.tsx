import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { fetchManagedCompetitions } from '../auth/wca';
import type { WCACompetition } from '../types/wcif';
import Header from '../components/Header';
import { useIsMobile } from '../lib/useIsMobile';

export default function CompetitionPickerPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    fetchManagedCompetitions(token.access_token)
      .then((data) => {
        const sorted = [...data].sort(
          (a: WCACompetition, b: WCACompetition) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
        setCompetitions(sorted);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  function selectCompetition(comp: WCACompetition) {
    sessionStorage.setItem('selected_competition_id', comp.id);
    sessionStorage.setItem('selected_competition_name', comp.name);
    navigate('/settings');
  }

  return (
    <div style={styles.container}>
      <Header showUser showSignOut />

      <main style={{ ...styles.main, ...(isMobile ? styles.mainMobile : {}) }}>
        <h2 style={styles.heading}>{t('picker.heading')}</h2>
        <p style={styles.hint}>{t('picker.hint')}</p>

        {isLoading && <p style={styles.status}>{t('picker.loading')}</p>}
        {error && <p style={{ ...styles.status, color: 'var(--danger)' }}>{t('picker.error', { message: error })}</p>}

        {!isLoading && !error && competitions.length === 0 && (
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
  heading: { margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text)' },
  hint: { margin: '0 0 28px', fontSize: 14, color: 'var(--text-muted)' },
  status: { fontSize: 15, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  gridMobile: { gridTemplateColumns: '1fr' },
  compCard: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '20px 24px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  compName: { fontSize: 16, fontWeight: 600, color: 'var(--text)' },
  compMeta: { fontSize: 13, color: 'var(--text-muted)' },
};
