import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchManagedCompetitions, WCA_API_URL } from '../auth/wca';
import type { WCACompetition } from '../types/wcif';

export default function CompetitionPickerPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
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
      <header style={styles.header}>
        <span style={styles.headerTitle}>WCA Scorecard Generator</span>
        <div style={styles.userInfo}>
          <img
            src={`${WCA_API_URL}/users/${user?.id}/avatar/thumb`}
            alt=""
            style={styles.avatar}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <span style={styles.userName}>{user?.name}</span>
          <button style={styles.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <h2 style={styles.heading}>Select a Competition</h2>
        <p style={styles.hint}>Showing competitions you manage or delegate.</p>

        {isLoading && <p style={styles.status}>Loading competitions…</p>}
        {error && <p style={{ ...styles.status, color: '#c00' }}>Error: {error}</p>}

        {!isLoading && !error && competitions.length === 0 && (
          <p style={styles.status}>No competitions found. Make sure you are a delegate or organizer.</p>
        )}

        <div style={styles.grid}>
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
    backgroundColor: '#f5f5f5',
    fontFamily: 'Helvetica, Arial, sans-serif',
  },
  header: {
    backgroundColor: '#003087',
    color: '#fff',
    padding: '0 32px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 12 },
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
  main: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '40px 24px',
  },
  heading: { margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
  hint: { margin: '0 0 28px', fontSize: 14, color: '#666' },
  status: { fontSize: 15, color: '#666', textAlign: 'center', padding: '32px 0' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  compCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    padding: '20px 24px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  compName: { fontSize: 16, fontWeight: 600, color: '#1a1a1a' },
  compMeta: { fontSize: 13, color: '#666' },
};
