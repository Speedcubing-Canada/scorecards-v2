import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { fetchWcif } from '../auth/wca';
import { getCachedWcif, setCachedWcif } from '../lib/wcifCache';
import { parseWCIF, type ParsedWCIF } from '../lib/wcif-parser';
import {
  availableRounds, latestAssignedRound, filterParsedByScope, hasUnassignedIntermediate,
  type GenerationScope,
} from '../lib/generationScope';
import type { CompetitionSettings, LocaleCode } from '../types/settings';
import Header from '../components/Header';
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
  const [scopeMode, setScopeMode] = useState<'everything' | 'latest' | 'selected'>('latest');
  // null ⇒ not customised yet; falls back to the latest round.
  const [selectedKeys, setSelectedKeys] = useState<Set<string> | null>(null);

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
          scrambleDoubleCheck: false, scrambleDoubleCheckRounds: [], scrambleDoubleCheckOverrides: {},
          generationScope: { mode: 'everything' },
        };
        const result = parseWCIF(wcif, detectionSettings);
        if (cancelled) return;

        // Pre-competition (only Round 1 assigned): nothing to choose — go straight to Settings.
        if (result.laterRoundsWithAssignments.length === 0) {
          persistScope({ mode: 'everything' }, hasUnassignedIntermediate(result));
          navigate('/settings', { replace: true });
          return;
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
        if (!labels.has(k)) labels.set(k, `${e.eventName} — ${e.roundLabel}`);
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
    const scope: GenerationScope = scopeMode === 'selected'
      ? {
          mode: 'selected',
          rounds: [...effectiveSelected].map(k => {
            const [eventId, r] = k.split('|');
            return { eventId, roundNum: Number(r) };
          }),
        }
      : { mode: scopeMode };
    const showSecondRoundMode = hasUnassignedIntermediate(filterParsedByScope(parsed, scope));
    persistScope(scope, showSecondRoundMode);
    navigate('/settings');
  }

  const continueDisabled = scopeMode === 'selected' && effectiveSelected.size === 0;

  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate('/competitions')} showSignOut />

      <main style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <div style={s.compBadge}>{competitionName}</div>
        <h2 style={s.pageTitle}>{t('scope.heading')}</h2>

        {status === 'loading' && (
          <div style={s.statusBox}>
            <span style={{ fontSize: 24 }}>⏳</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('scope.checking')}</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ ...s.statusBox, ...s.statusError }}>
            <span style={{ fontSize: 24 }}>❌</span>
            <span style={{ fontSize: 14, color: 'var(--danger)' }}>{statusMsg}</span>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p style={s.intro}>{t('scope.intro')}</p>

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
    borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, marginBottom: 8,
  },
  pageTitle: { margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text)' },
  intro: { margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted)' },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '40px 24px', textAlign: 'center', marginBottom: 24,
  },
  statusError: { borderColor: 'var(--danger)', backgroundColor: 'var(--primary-soft-bg)' },
  optionGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'var(--surface)',
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)',
    borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
  },
  optionCardActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  radio: { marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 },
  optionLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: 'var(--text-muted)' },
  continueBtn: {
    display: 'block', marginTop: 24, backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 8, padding: '16px', fontSize: 15,
    fontWeight: 700, textAlign: 'center', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', letterSpacing: '-0.01em',
  },
  continueBtnDisabled: { backgroundColor: 'var(--primary-disabled)', cursor: 'not-allowed' },
};
