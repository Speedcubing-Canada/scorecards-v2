import { useState, useEffect, useRef, useMemo } from 'react';
import { Download, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { fetchErrorKey, fetchWcif } from '../auth/wca';
import { getCachedWcif, setCachedWcif } from '../lib/wcifCache';
import type { CompetitionSettings } from '../types/settings';
import { parseWCIF, emptyParsedWcif, type ParsedWCIF } from '../lib/wcif-parser';
import { filterParsedByScope, type GenerationScope } from '../lib/generationScope';
import { estimateTotalPages } from '../lib/pageEstimate';
import { customEventPageCount } from '../lib/customScorecards';
import { buildPdfJobs, downloadTarget } from '../lib/pdfJobs';
import * as analytics from '../lib/analytics';
import { readPresetId } from '../presets';
import type { WorkerRequest, WorkerResponse } from '../pdf/scorecardWorker';
import Header from '../components/Header';
import WarningBanner from '../components/WarningBanner';
import Skeleton from '../components/Skeleton';
import PrintGuide from '../components/PrintGuide';
import { useIsMobile } from '../lib/useIsMobile';
import { readSettings } from '../lib/flowState';
import { downloadButtonFontSize } from '../lib/downloadButtonFontSize';
import i18n from '../i18n/index';

type Status = 'idle' | 'fetching' | 'parsing' | 'ready' | 'building' | 'error';

export default function GeneratePage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const settings: CompetitionSettings | null = readSettings();

  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [buildPercent, setBuildPercent] = useState(0);
  const [parsed, setParsed] = useState<ParsedWCIF | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Memoised on stable string keys: `settings` is re-parsed from sessionStorage every
  // render, so it is never referentially equal to itself.
  const settingsKey = JSON.stringify(settings);
  const scopeKey = JSON.stringify(settings?.generationScope ?? { mode: 'everything' });
  const scope = useMemo<GenerationScope>(() => JSON.parse(scopeKey) as GenerationScope, [scopeKey]);

  useEffect(() => {
    if (!settings || !token) return;
    let cancelled = false;

    async function run() {
      // Custom competitions have no WCIF; only settings.customEvents drive the PDFs.
      if (settings!.isCustomCompetition) {
        setParsed(emptyParsedWcif());
        setStatus('ready');
        return;
      }

      setStatus('fetching');
      // React state is stale in this closure, so the error event needs its own step.
      let stage: analytics.ErrorStage = 'fetch';
      try {
        const wcif = getCachedWcif(settings!.competitionId)
          ?? await fetchWcif(settings!.competitionId, token!.access_token);
        if (cancelled) return;
        setCachedWcif(settings!.competitionId, wcif);

        setStatus('parsing');
        stage = 'parse';
        const result = parseWCIF(wcif, settings!);
        if (cancelled) return;

        setParsed(result);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        analytics.send(analytics.buildErrorEvent(settings!.competitionId, stage, e));
        const key = fetchErrorKey(e);
        setStatusMsg(key ? t(key) : String(e));
        setStatus('error');
      }
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const effectiveParsed = useMemo(
    () => (parsed ? filterParsedByScope(parsed, scope) : null),
    [parsed, scope],
  );

  // The list the worker renders from. Above the redirect so the hook order never changes.
  const jobs = useMemo(
    () => (effectiveParsed && settings ? buildPdfJobs(effectiveParsed, settings) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveParsed, settingsKey],
  );
  const totalPages = useMemo(
    () => (effectiveParsed && settings ? estimateTotalPages(effectiveParsed, settings, jobs) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveParsed, jobs, settingsKey],
  );

  if (!settings) {
    navigate('/competitions', { replace: true });
    return null;
  }

  const allEntries = effectiveParsed
    ? [...effectiveParsed.firstRound, ...effectiveParsed.intermediate, ...effectiveParsed.semis, ...effectiveParsed.finals]
    : [];
  const customCardCount = (settings.customEvents ?? [])
    .filter(c => c.name.trim())
    .reduce((n, c) => n + customEventPageCount(c) * 4, 0);
  const scorecardCount = allEntries.filter(e => e.kind === 'scorecard').length + customCardCount;
  const coverCount     = allEntries.filter(e => e.kind === 'cover' && e.eventId).length;
  const pdfCount       = jobs.length;
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

    const uiLang = (i18n.language?.slice(0, 2) ?? 'en') as 'en' | 'fr' | 'es' | 'pt';

    worker.onerror = (e) => {
      analytics.send(analytics.buildErrorEvent(settings!.competitionId, 'render', e.message));
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
        // The worker decided zip-vs-bare-PDF, and hands over a Blob: a WC-sized archive
        // must never be copied through the heap on this side either.
        const url  = URL.createObjectURL(msg.blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = msg.filename;
        a.click();
        // Revoked on the next tick: a synchronous revoke can cancel a large download.
        setTimeout(() => URL.revokeObjectURL(url), 0);
        worker.terminate();
        workerRef.current = null;
        setStatus('ready');
        // After the download, so a beacon failure cannot cost anyone their PDFs. `parsed`
        // sizes the competition; the counts below describe only this download.
        analytics.send(analytics.buildGenerateEvent({
          parsed: parsed!,
          wcif: getCachedWcif(settings!.competitionId) ?? null,
          settings: settings!,
          uiLanguage: uiLang,
          presetId: readPresetId(),
          output: analytics.buildOutput(jobs, totalPages, scorecardCount, coverCount),
        }));
      } else {
        analytics.send(analytics.buildErrorEvent(settings!.competitionId, 'render', msg.message));
        setStatusMsg(msg.message);
        setStatus('error');
        worker.terminate();
        workerRef.current = null;
      }
    };

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
                  {status !== 'building' && <Download size={18} aria-hidden />}
                  {buttonLabel}
                </button>
              );
            })()}

            <PrintGuide jobs={jobs} />
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

/** Mirrors the stats grid and download button, so the layout doesn't shift on arrival. */
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
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
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
