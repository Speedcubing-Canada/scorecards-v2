import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { WCA_API_URL } from '../auth/wca';
import type { CompetitionSettings } from '../types/settings';
import type { WCIF } from '../types/wcif';
import { parseWCIF, type ParsedWCIF } from '../lib/wcif-parser';
import type { WorkerRequest, WorkerResponse } from '../pdf/scorecardWorker';

type Status = 'idle' | 'fetching' | 'parsing' | 'ready' | 'building' | 'error';

export default function GeneratePage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const raw = sessionStorage.getItem('competition_settings');
  const settings: CompetitionSettings | null = raw ? JSON.parse(raw) : null;

  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [buildPercent, setBuildPercent] = useState(0);
  const [parsed, setParsed] = useState<ParsedWCIF | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!settings || !token) return;
    let cancelled = false;

    async function run() {
      setStatus('fetching');
      try {
        const res = await fetch(
          `${WCA_API_URL}/competitions/${settings!.competitionId}/wcif`,
          { headers: { Authorization: `Bearer ${token!.access_token}` } },
        );
        if (!res.ok) throw new Error(`WCIF fetch failed (${res.status})`);
        const wcif: WCIF = await res.json();
        if (cancelled) return;

        setStatus('parsing');
        const result = parseWCIF(wcif, settings!);
        if (cancelled) return;

        setParsed(result);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) { setStatusMsg(String(e)); setStatus('error'); }
      }
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Terminate any running worker on unmount
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  if (!settings) {
    navigate('/competitions', { replace: true });
    return null;
  }

  const allEntries = parsed
    ? [...parsed.firstRound, ...parsed.intermediate, ...parsed.finals]
    : [];
  const scorecardCount = allEntries.filter(e => e.kind === 'scorecard').length;
  const coverCount     = allEntries.filter(e => e.kind === 'cover' && e.eventId).length;
  const pdfCount       = parsed
    ? [parsed.firstRound, parsed.intermediate, parsed.finals].filter(r => r.length > 0).length
    : 0;
  const filename       = `${settings.competitionId}_scorecards.zip`;

  function handleDownload() {
    if (status === 'building' || !parsed) return;

    workerRef.current?.terminate();
    const worker = new Worker(
      new URL('../pdf/scorecardWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    setStatus('building');
    setStatusMsg('Starting…');
    setBuildPercent(0);

    worker.onerror = (e) => {
      setStatusMsg(`Worker error: ${e.message}`);
      setStatus('error');
      worker.terminate();
      workerRef.current = null;
    };

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setBuildPercent(msg.percent);
        setStatusMsg(msg.message);
      } else if (msg.type === 'done') {
        const blob = new Blob([msg.buffer], { type: 'application/zip' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        worker.terminate();
        workerRef.current = null;
        setStatus('ready');
      } else {
        setStatusMsg(msg.message);
        setStatus('error');
        worker.terminate();
        workerRef.current = null;
      }
    };

    const req: WorkerRequest = { parsed, settings };
    worker.postMessage(req);
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => navigate('/settings')}>← Back</button>
        <span style={s.title}>Generate Scorecards</span>
        <span />
      </header>

      <main style={s.main}>
        <div style={s.compBadge}>{settings.competitionName}</div>

        {status === 'fetching' && <StatusBox icon="⏳" text="Fetching WCIF from WCA…" />}
        {status === 'parsing'  && <StatusBox icon="⚙️" text="Building scorecard list…" />}
        {status === 'error'    && <StatusBox icon="❌" text={statusMsg} isError />}
        {status === 'building' && (
          <div style={s.progressBox}>
            <div style={s.progressHeader}>
              <span style={s.progressLabel}>{statusMsg || 'Rendering PDF…'}</span>
              <span style={s.progressPct}>{buildPercent}%</span>
            </div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${buildPercent}%` }} />
            </div>
          </div>
        )}

        {(status === 'ready' || status === 'building') && (
          <>
            {status === 'ready' && (
              <div style={s.stats}>
                <Stat label="Scorecards" value={scorecardCount} />
                <Stat label="Cover cards" value={coverCount} />
                <Stat label="PDFs in ZIP" value={pdfCount} />
                <Stat label="Paper" value={settings.paperFormat} />
              </div>
            )}

            <button
              style={{ ...s.downloadBtn, ...(status === 'building' ? s.downloadBtnDisabled : {}) }}
              onClick={handleDownload}
              disabled={status === 'building'}
            >
              {status === 'building' ? 'Building ZIP…' : `⬇ Download ${filename}`}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function StatusBox({ icon, text, isError = false }: { icon: string; text: string; isError?: boolean }) {
  return (
    <div style={{ ...s.statusBox, ...(isError ? s.statusError : {}) }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 14, color: isError ? '#c00' : '#555' }}>{text}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={s.stat}>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'Helvetica, Arial, sans-serif' },
  header: {
    backgroundColor: '#003087', color: '#fff', padding: '0 24px',
    height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  back: {
    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer',
  },
  title: { fontSize: 16, fontWeight: 700 },
  main: { maxWidth: 680, margin: '0 auto', padding: '32px 24px' },
  compBadge: {
    display: 'inline-block', backgroundColor: '#e8edf7', color: '#003087',
    borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, marginBottom: 24,
  },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', border: '1px solid #e0e0e0',
    borderRadius: 10, padding: '40px 24px', textAlign: 'center', marginBottom: 24,
  },
  statusError: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24,
  },
  stat: {
    backgroundColor: '#fff', border: '1px solid #e0e0e0',
    borderRadius: 8, padding: '16px', textAlign: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 700, color: '#003087', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666' },
  downloadBtn: {
    display: 'block', backgroundColor: '#003087', color: '#fff',
    border: 'none', borderRadius: 8, padding: '16px', fontSize: 16,
    fontWeight: 600, textAlign: 'center', cursor: 'pointer', width: '100%',
  },
  downloadBtnDisabled: {
    backgroundColor: '#7a9cbf', cursor: 'not-allowed',
  },
  progressBox: {
    backgroundColor: '#fff', border: '1px solid #e0e0e0',
    borderRadius: 10, padding: '24px 28px', marginBottom: 24,
  },
  progressHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  progressLabel: { fontSize: 14, color: '#555' },
  progressPct: { fontSize: 20, fontWeight: 700, color: '#003087' },
  progressTrack: {
    height: 10, backgroundColor: '#e8edf7', borderRadius: 5, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#003087', borderRadius: 5,
    transition: 'width 0.2s ease',
  },
};
