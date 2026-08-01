import { useState, useEffect, useMemo } from 'react';
import { XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { fetchWcif } from '../auth/wca';
import { getCachedWcif, setCachedWcif } from '../lib/wcifCache';
import { parseWCIF, type ParsedWCIF } from '../lib/wcif-parser';
import {
  availableRounds, latestAssignedRound, filterParsedByScope, hasUnassignedIntermediate,
  type GenerationScope, type DocumentSelection,
} from '../lib/generationScope';
import type { CompetitionSettings, LocaleCode } from '../types/settings';
import Header from '../components/Header';
import Skeleton from '../components/Skeleton';
import { useIsMobile } from '../lib/useIsMobile';

type Status = 'loading' | 'ready' | 'error';

const keyOf = (eventId: string, roundNum: number) => `${eventId}|${roundNum}`;

function persistScope(scope: GenerationScope, showSecondRoundMode: boolean) {
  sessionStorage.setItem('generation_scope', JSON.stringify(scope));
  sessionStorage.setItem('generation_detection', JSON.stringify({ showSecondRoundMode }));
}

export default function RoundScopePage() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const competitionId = sessionStorage.getItem('selected_competition_id') ?? '';
  const competitionName = sessionStorage.getItem('selected_competition_name') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [statusMsg, setStatusMsg] = useState('');
  const [parsed, setParsed] = useState<ParsedWCIF | null>(null);
  const [isMidComp, setIsMidComp] = useState(false);

  // Round-scope state (mid-competition only)
  const [scopeMode, setScopeMode] = useState<'everything' | 'latest' | 'selected'>('latest');
  const [selectedKeys, setSelectedKeys] = useState<Set<string> | null>(null);

  // Document-type state - pre-comp defaults; overridden to mid-comp defaults once data loads
  const [docScorecards, setDocScorecards] = useState(true);
  const [docSchedule, setDocSchedule]     = useState(true);
  const [docNametags, setDocNametags]     = useState(true);
  const [docFirstTimers, setDocFirstTimers] = useState(false);

  useEffect(() => {
    if (!competitionId || !token) return;
    let cancelled = false;

    async function run() {
      try {
        const wcif = getCachedWcif(competitionId) ?? await fetchWcif(competitionId, token!.access_token);
        if (cancelled) return;
        setCachedWcif(competitionId, wcif);

        const uiLang = (i18n.language?.slice(0, 2) ?? 'en') as LocaleCode;
        const detectionSettings: CompetitionSettings = {
          competitionId, competitionName,
          language: uiLang, secondaryLanguage: null,
          paperFormat: 'LETTER', secondRoundMode: 'blanks',
          logoDataUrl: null, useDefaultLogo: true,
          wcaLiveId: null, wcaLivePersonIds: null, hideWcaLiveId: false,
          nametagLogoMode: 'with-name', nametagQrMode: 'back-only', nametagLayout: 'vertical',
          customEvents: [],
          // Detection-only parse; the real mode is chosen later on /settings.
          scorecardCheckMode: 'per-group-card',
          scrambleDoubleCheck: false, scrambleDoubleCheckRounds: [], scrambleDoubleCheckOverrides: {},
          generationScope: { mode: 'everything', documents: { scorecards: true, scheduleTracker: true, nametags: true, firstTimerSlips: false } },
          isCustomCompetition: false,
        };
        const result = parseWCIF(wcif, detectionSettings);
        if (cancelled) return;

        // Surface whether groups have been generated so the Settings page can warn
        // without re-fetching the WCIF (scope always runs before settings).
        sessionStorage.setItem('competition_has_groups', String(result.hasGroups));

        const midComp = result.laterRoundsWithAssignments.length > 0;
        setIsMidComp(midComp);

        if (midComp) {
          // Mid-competition default: scorecards only
          setDocSchedule(false);
          setDocNametags(false);
        }

        setParsed(result);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) { setStatusMsg(String(e)); setStatus('error'); }
      }
    }

    run();
    return () => { cancelled = true; };
  // competitionId/token are stable for the lifetime of this page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roundOptions = useMemo(() => {
    if (!parsed) return [] as { key: string; label: string }[];
    const labels = new Map<string, string>();
    for (const bucket of [parsed.firstRound, parsed.intermediate, parsed.semis, parsed.finals]) {
      for (const e of bucket) {
        if (e.kind === 'cover' && !e.eventId) continue;
        const k = keyOf(e.eventId, e.roundNum);
        if (!labels.has(k)) labels.set(k, `${e.eventName} - ${e.roundLabel}`);
      }
    }
    return availableRounds(parsed).map(r => ({
      key: keyOf(r.eventId, r.roundNum),
      label: labels.get(keyOf(r.eventId, r.roundNum)) ?? keyOf(r.eventId, r.roundNum),
    }));
  }, [parsed]);

  const defaultSelected = useMemo(() => {
    if (!parsed) return new Set<string>();
    const latest = latestAssignedRound(parsed);
    return new Set(
      availableRounds(parsed)
        .filter(r => r.roundNum === latest)
        .map(r => keyOf(r.eventId, r.roundNum)),
    );
  }, [parsed]);
  const effectiveSelected = selectedKeys ?? defaultSelected;

  function toggleRound(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev ?? defaultSelected);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleContinue() {
    if (!parsed) return;

    const documents: DocumentSelection = {
      scorecards: docScorecards,
      scheduleTracker: docSchedule,
      nametags: docNametags,
      firstTimerSlips: docFirstTimers,
    };

    const scope: GenerationScope = isMidComp
      ? (scopeMode === 'selected'
          ? {
              mode: 'selected',
              rounds: [...effectiveSelected].map(k => {
                const [eventId, r] = k.split('|');
                return { eventId, roundNum: Number(r) };
              }),
              documents,
            }
          : { mode: scopeMode, documents })
      : { mode: 'everything', documents };

    const showSecondRoundMode = hasUnassignedIntermediate(filterParsedByScope(parsed, scope));
    persistScope(scope, showSecondRoundMode);
    navigate('/settings');
  }

  const noDocsSelected = !docScorecards && !docSchedule && !docNametags && !docFirstTimers;
  const continueDisabled =
    (isMidComp && scopeMode === 'selected' && effectiveSelected.size === 0) || noDocsSelected;

  const docOptions: { key: keyof DocumentSelection; label: string; checked: boolean; set: (v: boolean) => void }[] = [
    { key: 'scorecards',      label: t('scope.doc_scorecards'),  checked: docScorecards,  set: setDocScorecards },
    { key: 'scheduleTracker', label: t('scope.doc_schedule'),    checked: docSchedule,    set: setDocSchedule },
    { key: 'nametags',        label: t('scope.doc_nametags'),    checked: docNametags,    set: setDocNametags },
    { key: 'firstTimerSlips', label: t('scope.doc_first_timers'),checked: docFirstTimers, set: setDocFirstTimers },
  ];

  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate('/competitions')} showSignOut />

      <main style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <div style={s.compBadge}>{competitionName}</div>
        <h2 style={s.pageTitle}>{t('scope.heading')}</h2>

        {status === 'loading' && (
          <div role="status" aria-label={t('scope.checking')}>
            <Skeleton width="55%" height={14} style={{ marginBottom: 20 }} />
            <Skeleton width={140} height={15} style={{ marginBottom: 12 }} />
            <div style={s.optionGroup}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={62} radius="var(--radius-md)" />
              ))}
            </div>
          </div>
        )}
        {status === 'error' && (
          <div style={{ ...s.statusBox, ...s.statusError }}>
            <XCircle size={28} strokeWidth={2} color="var(--danger)" />
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--danger)' }}>{statusMsg}</span>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p style={s.intro}>{isMidComp ? t('scope.intro') : t('scope.intro_pre')}</p>

            {isMidComp && (
              <>
                <h3 style={s.sectionHeading}>{t('scope.rounds_heading')}</h3>
                <div style={s.optionGroup}>
                  {(['latest', 'everything', 'selected'] as const).map(mode => (
                    <label key={mode} style={{ ...s.optionCard, ...(scopeMode === mode ? s.optionCardActive : {}) }}>
                      <input
                        type="radio"
                        name="scope"
                        checked={scopeMode === mode}
                        onChange={() => setScopeMode(mode)}
                        style={s.radio}
                      />
                      <div>
                        <div style={s.optionLabel}>{t(`scope.${mode}.label`)}</div>
                        <div style={s.optionDesc}>{t(`scope.${mode}.desc`)}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {scopeMode === 'selected' && (
                  <div style={{ ...s.optionGroup, marginTop: 10 }}>
                    {roundOptions.map(o => (
                      <label key={o.key} style={{ ...s.optionCard, ...(effectiveSelected.has(o.key) ? s.optionCardActive : {}) }}>
                        <input
                          type="checkbox"
                          checked={effectiveSelected.has(o.key)}
                          onChange={() => toggleRound(o.key)}
                          style={s.radio}
                        />
                        <div style={s.optionLabel}>{o.label}</div>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            <h3 style={{ ...s.sectionHeading, marginTop: isMidComp ? 24 : 0 }}>{t('scope.docs_title')}</h3>
            <div style={s.optionGroup}>
              {docOptions.map(o => (
                <label key={o.key} style={{ ...s.optionCard, ...(o.checked ? s.optionCardActive : {}) }}>
                  <input
                    type="checkbox"
                    checked={o.checked}
                    onChange={e => o.set(e.target.checked)}
                    style={s.radio}
                  />
                  <div style={s.optionLabel}>{o.label}</div>
                </label>
              ))}
            </div>

            <button
              style={{ ...s.continueBtn, ...(continueDisabled ? s.continueBtnDisabled : {}) }}
              onClick={handleContinue}
              disabled={continueDisabled}
            >
              {t('scope.continue')}
            </button>
          </>
        )}
      </main>
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
  pageTitle: { margin: '0 0 8px', fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--text)' },
  sectionHeading: { margin: '0 0 12px', fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' },
  intro: { margin: '0 0 20px', fontSize: 'var(--fs-body)', color: 'var(--text-muted)' },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center', marginBottom: 24,
  },
  statusError: { borderColor: 'var(--danger)', backgroundColor: 'var(--primary-soft-bg)' },
  optionGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'var(--surface)',
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px', cursor: 'pointer',
  },
  optionCardActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  radio: { marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 },
  optionLabel: { fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  optionDesc: { fontSize: 'var(--fs-label)', color: 'var(--text-muted)' },
  continueBtn: {
    display: 'block', marginTop: 24, backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 'var(--radius-md)', padding: '16px', fontSize: 'var(--fs-heading)',
    fontWeight: 700, textAlign: 'center', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', letterSpacing: '-0.01em',
  },
  continueBtnDisabled: { backgroundColor: 'var(--primary-disabled)', cursor: 'not-allowed' },
};
