import { useState, useEffect, useRef, useMemo } from 'react';
import { XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { fetchWcif } from '../auth/wca';
import { getCachedWcif, setCachedWcif } from '../lib/wcifCache';
import type { CompetitionSettings } from '../types/settings';
import { parseWCIF, emptyParsedWcif, type ParsedWCIF } from '../lib/wcif-parser';
import { filterParsedByScope, type GenerationScope } from '../lib/generationScope';
import { estimateTotalPages } from '../lib/pageEstimate';
import { customEventPageCount } from '../lib/customScorecards';
import { buildPdfJobs, downloadTarget } from '../lib/pdfJobs';
import type { WorkerRequest, WorkerResponse } from '../pdf/scorecardWorker';
import Header from '../components/Header';
import WarningBanner from '../components/WarningBanner';
import Skeleton from '../components/Skeleton';
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
    scorecards: true, scheduleTracker: true, nametags: true,
    roundChecklist: false, firstTimerSlips: false,
  };
  // Payloads saved with the earlier four-key `documents` object are missing this one.
  const gsDocs = gs.documents as Record<string, unknown>;
  if (gsDocs.roundChecklist === undefined) gsDocs.roundChecklist = false;
  if (s.hideWcaLiveId === undefined) s.hideWcaLiveId = false;
  if (s.isCustomCompetition === undefined) s.isCustomCompetition = false;
  // Settings saved before the checking-mode option existed keep the original behaviour.
  if (s.scorecardCheckMode === undefined) s.scorecardCheckMode = 'per-group-card';
  // 'checking-sheet' used to mean "no cover cards, print the standalone sheet instead".
  // The sheet is now the opt-in Round Checklist document, so only the cover-card half of
  // that choice survives.
  if (s.scorecardCheckMode === 'checking-sheet') s.scorecardCheckMode = 'none';
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
      // Custom competitions have no WCIF - only settings.customEvents drive the PDFs.
      if (settings!.isCustomCompetition) {
        setParsed(emptyParsedWcif());
        setStatus('ready');
        return;
      }

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
  // Custom-event cards (4 per page: blanks, or named + pads) ship in the bundle too.
  const customCardCount = (settings.customEvents ?? [])
    .filter(c => c.name.trim())
    .reduce((n, c) => n + customEventPageCount(c) * 4, 0);
  const scorecardCount = allEntries.filter(e => e.kind === 'scorecard').length + customCardCount;
  const coverCount     = allEntries.filter(e => e.kind === 'cover' && e.eventId).length;
  // Same list the worker renders from, so the stat and the button label can
  // never disagree with what actually comes out.
  const jobs           = effectiveParsed ? buildPdfJobs(effectiveParsed, settings) : [];
  const pdfCount       = jobs.length;
  const totalPages     = effectiveParsed ? estimateTotalPages(effectiveParsed, settings) : 0;
  // One document downloads as itself; two or more are zipped.
  const filename       = downloadTarget(jobs, settings.competitionId).filename;

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
        // The worker decided zip-vs-bare-PDF, so take its word for both.
        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = msg.filename;
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

        {(status === 'fetching' || status === 'parsing') && (
          <StatsSkeleton isMobile={isMobile} label={status === 'fetching' ? t('generate.fetching') : t('generate.parsing')} />
        )}
        {status === 'error'    && (
          <StatusBox icon={<XCircle size={28} strokeWidth={2} color="var(--danger)" />} text={statusMsg} isError />
        )}
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
            {status === 'ready' && parsed?.hasGroups === false && (
              <WarningBanner>{t('warnings.no_groups')}</WarningBanner>
            )}

            {status === 'ready' && (
              <div style={{ ...s.stats, ...(isMobile ? s.statsMobile : {}) }}>
                <Stat label={t('generate.stats.scorecards')} value={scorecardCount} />
                <Stat label={t('generate.stats.cover_cards')} value={coverCount} />
                <Stat label={t('generate.stats.pdfs')} value={pdfCount} />
                <Stat label={t('generate.stats.total_pages')} value={totalPages} />
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

function StatusBox({ icon, text, isError = false }: { icon: React.ReactNode; text: string; isError?: boolean }) {
  return (
    <div style={{ ...s.statusBox, ...(isError ? s.statusError : {}) }}>
      {icon}
      <span style={{ fontSize: 'var(--fs-body)', color: isError ? 'var(--danger)' : 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

/**
 * Loading placeholder shown while the WCIF is fetched and parsed. Mirrors the
 * five-card stats grid and the download button so the layout doesn't shift once
 * the real numbers arrive. The status label is announced for screen readers.
 */
function StatsSkeleton({ isMobile, label }: { isMobile: boolean; label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div style={{ ...s.stats, ...(isMobile ? s.statsMobile : {}) }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={s.stat}>
            <Skeleton width={isMobile ? 48 : 56} height={isMobile ? 22 : 28} style={{ margin: '0 auto 8px' }} />
            <Skeleton width="70%" height={10} style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <Skeleton height={56} radius="var(--radius-md)" />
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
    borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--fs-label)', fontWeight: 700, marginBottom: 8,
  },
  pageTitle: { margin: '0 0 24px', fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--text)' },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center', marginBottom: 24,
  },
  statusError: { borderColor: 'var(--danger)', backgroundColor: 'var(--primary-soft-bg)' },
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24,
  },
  statsMobile: { gridTemplateColumns: 'repeat(2, 1fr)' },
  stat: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center',
  },
  statValue: { fontSize: 'var(--fs-stat)', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 },
  statValueMobile: { fontSize: 'var(--fs-display)' },
  statLabel: { fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' },
  downloadBtn: {
    display: 'block', backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 'var(--radius-md)', padding: '16px', fontSize: 'var(--fs-heading)',
    fontWeight: 700, textAlign: 'center', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', letterSpacing: '-0.01em', overflowWrap: 'anywhere',
  },
  downloadBtnDisabled: {
    backgroundColor: 'var(--primary-disabled)', cursor: 'not-allowed',
  },
  progressBox: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 24,
  },
  progressHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  progressLabel: { fontSize: 'var(--fs-body)', color: 'var(--text-muted)' },
  progressPct: { fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--primary)' },
  progressTrack: {
    height: 10, backgroundColor: 'var(--primary-soft-bg)', borderRadius: 5, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: 'var(--primary)', borderRadius: 5,
    transition: 'width 0.2s ease',
  },
};
