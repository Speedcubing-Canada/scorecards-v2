import { useAuth } from '../auth/AuthContext';
import { CLIENT_ID } from '../auth/wca';

export default function LoginPage() {
  const { login } = useAuth();
  const missingClientId = !CLIENT_ID;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>WCA Scorecard Generator</h1>
        <p style={styles.subtitle}>
          Generate print-ready scorecards and nametags for your WCA competition.
        </p>

        {missingClientId ? (
          <div style={styles.warning}>
            <strong>Setup required:</strong> Set <code>VITE_WCA_CLIENT_ID</code> in your{' '}
            <code>.env</code> file.
            <br />
            <br />
            Create a WCA OAuth application at{' '}
            <a href="https://www.worldcubeassociation.org/oauth/applications" target="_blank" rel="noreferrer">
              worldcubeassociation.org/oauth/applications
            </a>{' '}
            with redirect URI: <code>{window.location.origin}/auth/callback</code>
          </div>
        ) : (
          <button style={styles.button} onClick={login}>
            Sign in with WCA
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
