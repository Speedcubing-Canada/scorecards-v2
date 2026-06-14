import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { fetchWcif } from '../auth/wca';
import { getCachedWcif, setCachedWcif } from '../lib/wcifCache';
import type { CompetitionSettings } from '../types/settings';
import { parseWCIF, type ParsedWCIF } from '../lib/wcif-parser';
import { filterParsedByScope, type GenerationScope } from '../lib/generationScope';
import type { WorkerRequest, WorkerResponse } from '../pdf/scorecardWorker';
import Header from '../components/Header';
import { useIsMobile } from '../lib/useIsMobile';
import { downloadButtonFontSize } from '../lib/downloadButtonFontSize';
import i18n from '../i18n/index';

type Status = 'idle' | 'fetching' | 'parsing' | 'ready' | 'building' | 'error';

/**
 * Read persisted settings, migrating the retired bilingual presets onto the
 * primary + optional-secondary model. Also backfills `secondaryLanguage` so
 * settings saved before that field existed don't render as `undefined`, and
 * `generationScope` for settings saved before scoped generation existed.
 */
function loadSettings(raw: string | null): CompetitionSettings | null {
  if (!raw) return null;
  const s = JSON.parse(raw) as Record<string, unknown>;
  if (s.language === 'bilingual-fr') { s.language = 'fr'; s.secondaryLanguage = 'en'; }
  else if (s.language === 'bilingual-en') { s.language = 'en'; s.secondaryLanguage = 'fr'; }
  else if (s.secondaryLanguage === undefined) { s.secondaryLanguage = null; }
  if (s.generationScope === undefined) s.generationScope = { mode: 'everything' };
  const gs = s.generationScope as Record<string, unknown>;
  if (gs.documents === undefined) gs.documents = {
    scorecards: true, scheduleTracker: true, nametags: true, firstTimerSlips: false,
  };
  if (s.hideWcaLiveId === undefined) s.hideWcaLiveId = false;
  return s as unknown as CompetitionSettings;
}

export default function GeneratePage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const raw = sessionStorage.getItem('competition_settings');
  const settings: CompetitionSettings | null = loadSettings(raw);

  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [buildPercent, setBuildPercent] = useState(0);
  const [parsed, setParsed] = useState<ParsedWCIF | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // The scope is chosen up front on the scope step; here we just apply it. Memoise on a
  // stable string key since `settings` is re-parsed from sessionStorage every render.
  const scopeKey = JSON.stringify(settings?.generationScope ?? { mode: 'everything' });
  const scope = useMemo<GenerationScope>(() => JSON.parse(scopeKey) as GenerationScope, [scopeKey]);

  useEffect(() => {
    if (!settings || !token) return;
    let cancelled = false;

    async function run() {
      setStatus('fetching');
      try {
        const wcif = getCachedWcif(settings!.competitionId)
          ?? await fetchWcif(settings!.competitionId, token!.access_token);
        if (cancelled) return;
        setCachedWcif(settings!.competitionId, wcif);

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

  const effectiveParsed = useMemo(
    () => (parsed ? filterParsedByScope(parsed, scope) : null),
    [parsed, scope],
  );

  if (!settings) {
    navigate('/competitions', { replace: true });
    return null;
  }

  const allEntries = effectiveParsed
    ? [...effectiveParsed.firstRound, ...effectiveParsed.intermediate, ...effectiveParsed.semis, ...effectiveParsed.finals]
    : [];
  const scorecardCount = allEntries.filter(e => e.kind === 'scorecard').length;
  const coverCount     = allEntries.filter(e => e.kind === 'cover' && e.eventId).length;
  const pdfCount       = effectiveParsed
    ? [
        effectiveParsed.firstRound,
        effectiveParsed.intermediate,
        effectiveParsed.semis,
        effectiveParsed.finals,
        effectiveParsed.extras,
      ].filter(r => r.length > 0).length
      + (effectiveParsed.scheduleDays.length > 0 ? 1 : 0)
      + (effectiveParsed.nametags.length > 0 ? 1 : 0)
      + (effectiveParsed.firstTimers.length > 0 ? 1 : 0)
      + (settings.customEvents?.filter(c => c.name.trim()).length ?? 0)
    : 0;
  const filename       = `${settings.competitionId}_scorecards.zip`;

  function handleDownload() {
    if (status === 'building' || !effectiveParsed || pdfCount === 0) return;

    workerRef.current?.terminate();
    const worker = new Worker(
      new URL('../pdf/scorecardWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    setStatus('building');
    setStatusMsg('');
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

    const uiLang = (i18n.language?.slice(0, 2) ?? 'en') as 'en' | 'fr' | 'es' | 'pt';
    const req: WorkerRequest = { parsed: effectiveParsed, settings: settings!, uiLanguage: uiLang };
    worker.postMessage(req);
  }

  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate('/settings')} showSignOut />

      <main style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <div style={s.compBadge}>{settings.competitionName}</div>
        <h2 style={s.pageTitle}>{t('generate.title')}</h2>

        {status === 'fetching' && <StatusBox icon="⏳" text={t('generate.fetching')} />}
        {status === 'parsing'  && <StatusBox icon="⚙️" text={t('generate.parsing')} />}
        {status === 'error'    && <StatusBox icon="❌" text={statusMsg} isError />}
        {status === 'building' && (
          <div style={s.progressBox}>
            <div style={s.progressHeader}>
              <span style={s.progressLabel}>{statusMsg || t('generate.rendering')}</span>
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
              <div style={{ ...s.stats, ...(isMobile ? s.statsMobile : {}) }}>
                <Stat label={t('generate.stats.scorecards')} value={scorecardCount} />
                <Stat label={t('generate.stats.cover_cards')} value={coverCount} />
                <Stat label={t('generate.stats.pdfs_in_zip')} value={pdfCount} />
                <Stat label={t('generate.stats.paper')} value={settings.paperFormat} />
              </div>
            )}

            {(() => {
              const buttonLabel = status === 'building'
                ? t('generate.building_button')
                : t('generate.download_button', { filename });
              const disabled = status === 'building' || pdfCount === 0;
              return (
                <button
                  style={{
                    ...s.downloadBtn,
                    fontSize: downloadButtonFontSize(buttonLabel),
                    ...(disabled ? s.downloadBtnDisabled : {}),
                  }}
                  onClick={handleDownload}
                  disabled={disabled}
                >
                  {buttonLabel}
                </button>
              );
            })()}
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
      <span style={{ fontSize: 14, color: isError ? 'var(--danger)' : 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const isMobile = useIsMobile();
  return (
    <div style={s.stat}>
      <div style={{ ...s.statValue, ...(isMobile ? s.statValueMobile : {}) }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: 'var(--bg)' },
  main: { maxWidth: 680, margin: '0 auto', padding: '32px 24px' },
  mainMobile: { padding: '24px 16px' },
  compBadge: {
    display: 'inline-block', backgroundColor: 'var(--primary-soft-bg)', color: 'var(--primary-soft-text)',
    borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, marginBottom: 8,
  },
  pageTitle: { margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: 'var(--text)' },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '40px 24px', textAlign: 'center', marginBottom: 24,
  },
  statusError: { borderColor: 'var(--danger)', backgroundColor: 'var(--primary-soft-bg)' },
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24,
  },
  statsMobile: { gridTemplateColumns: 'repeat(2, 1fr)' },
  stat: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '16px', textAlign: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 },
  statValueMobile: { fontSize: 22 },
  statLabel: { fontSize: 12, color: 'var(--text-muted)' },
  downloadBtn: {
    display: 'block', backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 8, padding: '16px', fontSize: 15,
    fontWeight: 700, textAlign: 'center', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', letterSpacing: '-0.01em', overflowWrap: 'anywhere',
  },
  downloadBtnDisabled: {
    backgroundColor: 'var(--primary-disabled)', cursor: 'not-allowed',
  },
  progressBox: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '24px 28px', marginBottom: 24,
  },
  progressHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  progressLabel: { fontSize: 14, color: 'var(--text-muted)' },
  progressPct: { fontSize: 20, fontWeight: 700, color: 'var(--primary)' },
  progressTrack: {
    height: 10, backgroundColor: 'var(--primary-soft-bg)', borderRadius: 5, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: 'var(--primary)', borderRadius: 5,
    transition: 'width 0.2s ease',
  },
};
