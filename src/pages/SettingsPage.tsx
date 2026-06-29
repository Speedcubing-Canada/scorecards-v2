import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Check, ChevronDown, ChevronRight, RectangleHorizontal, RectangleVertical, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CompetitionSettings, CustomEvent, DoubleCheckRound, LocaleCode, NametTagLayout, NametTagLogoMode, NametTagQrMode, PaperFormat, ScrambleDoubleCheckOverrides, SecondRoundMode } from '../types/settings';
import type { GenerationScope, DocumentSelection } from '../lib/generationScope';
import { LANGUAGES } from '../i18n/index';
import { resolveDefaultPrimaryLanguage, secondaryLanguageRow, isCanadianLanguage } from '../lib/languageSelector';
import { parseDoubleCheckOverrides } from '../lib/parseDoubleCheckOverrides';
import { EVENT_ICONS } from '../assets/events';
import { SCC_DEFAULT_LOGO } from '../assets/scc-logo';
import Header from '../components/Header';
import WarningBanner from '../components/WarningBanner';
import Tooltip from '../components/Tooltip';
import { useIsMobile } from '../lib/useIsMobile';
import { fetchWcaLiveId, fetchWcaLivePersonIds } from '../auth/wca';

const WCA_EVENT_LABELS: Record<string, string> = {
  '222': '2×2', '333': '3×3', '444': '4×4', '555': '5×5',
  '666': '6×6', '777': '7×7', '333bf': '3BLD', '333fm': 'FMC',
  '333oh': 'OH', 'clock': 'Clock', 'minx': 'Mega', 'pyram': 'Pyra',
  'skewb': 'Skewb', 'sq1': 'SQ1', '444bf': '4BLD', '555bf': '5BLD',
  '333mbf': 'MBLD',
};

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const competitionId = sessionStorage.getItem('selected_competition_id') ?? '';
  const competitionName = sessionStorage.getItem('selected_competition_name') ?? '';
  // Set on the scope step from the parsed WCIF. When groups haven't been generated yet,
  // scorecard counts will read 0 — warn so organizers aren't confused.
  const noGroups = sessionStorage.getItem('competition_has_groups') === 'false';

  // Decided on the scope step. When generating scorecards only (scope ≠ everything), the
  // Settings page shows just what's relevant to scorecards.
  const scopeRaw = sessionStorage.getItem('generation_scope');
  const generationScope: GenerationScope = scopeRaw
    ? JSON.parse(scopeRaw)
    : { mode: 'everything', documents: { scorecards: true, scheduleTracker: true, nametags: true, firstTimerSlips: false } };
  const detectionRaw = sessionStorage.getItem('generation_detection');
  const detection = detectionRaw ? JSON.parse(detectionRaw) as { showSecondRoundMode?: boolean } : null;
  const everything = generationScope.mode === 'everything';
  const docs = (generationScope as { documents?: DocumentSelection }).documents;
  const showScorecards = docs?.scorecards !== false;
  const showNametags   = docs?.nametags   !== false;
  // Round 2 prefilled/blanks only matters when an unassigned Round 2 will actually be
  // generated. Absent detection (step bypassed) ⇒ show it, preserving prior behaviour.
  const showSecondRoundMode = detection?.showSecondRoundMode !== false;

  // Default the primary scorecard language to whatever interface language the
  // user is already using (saves a click for most people); secondary starts as
  // None so single-language users don't have to clear anything.
  const defaultPrimary = resolveDefaultPrimaryLanguage(
    i18n.resolvedLanguage ?? i18n.language,
    LANGUAGES,
  );

  const [language, setLanguage] = useState<LocaleCode>(defaultPrimary);
  const [secondaryLanguage, setSecondaryLanguage] = useState<LocaleCode | null>(null);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('LETTER');
  const [secondRoundMode, setSecondRoundMode] = useState<SecondRoundMode>('prefilled');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [useDefaultLogo, setUseDefaultLogo] = useState<boolean>(
    isCanadianLanguage(i18n.resolvedLanguage ?? i18n.language),
  );
  const [wcaLiveId, setWcaLiveId] = useState<string>('');
  const [wcaLivePersonIds, setWcaLivePersonIds] = useState<Record<number, string> | null>(null);
  const [wcaLiveFetchStatus, setWcaLiveFetchStatus] = useState<'loading' | 'found' | 'not-found'>('loading');
  const [hideWcaLiveId, setHideWcaLiveId] = useState<boolean>(false);
  const [nametagLogoMode, setNametagLogoMode] = useState<NametTagLogoMode>('with-name');
  const [nametagQrMode, setNametagQrMode] = useState<NametTagQrMode>('back-only');
  const [nametagLayout, setNametagLayout] = useState<NametTagLayout>('vertical');
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scrambleDoubleCheck, setScrambleDoubleCheck] = useState<boolean>(false);
  const [scrambleDoubleCheckRounds, setScrambleDoubleCheckRounds] = useState<DoubleCheckRound[]>(['finals']);
  const [scrambleDoubleCheckOverrides, setScrambleDoubleCheckOverrides] = useState<ScrambleDoubleCheckOverrides>({});
  const [dcOverridesName, setDcOverridesName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dcFileInputRef = useRef<HTMLInputElement>(null);
  const customIconRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!competitionId) return;
    fetchWcaLiveId(competitionId).then(async id => {
      if (id) {
        setWcaLiveId(id);
        setWcaLiveFetchStatus('found');
        const personIds = await fetchWcaLivePersonIds(id);
        setWcaLivePersonIds(personIds);
      } else {
        setWcaLiveFetchStatus('not-found');
      }
    });
  // competitionId is stable (from sessionStorage), no deps needed beyond mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!competitionId) {
    navigate('/competitions', { replace: true });
    return null;
  }

  // Language pickers are driven by the shared LANGUAGES registry (native labels),
  // so adding a language needs no per-language settings strings here. Primary and
  // secondary rows share the same fixed columns (one language each); the column
  // under the selected primary becomes the "None" tile so nothing ever shifts.
  function handlePrimaryLanguageChange(code: LocaleCode) {
    setLanguage(code);
    if (secondaryLanguage === code) setSecondaryLanguage(null);
  }

  // A compact, tappable language tile (monogram badge + native label) in the
  // spirit of an event-icon selector — far less form-like than a radio list.
  const renderLangTile = (o: { key: string; badge: string; label: string; selected: boolean; onClick: () => void }) => (
    <button
      key={o.key}
      type="button"
      onClick={o.onClick}
      aria-pressed={o.selected}
      style={{ ...s.langTile, ...(o.selected ? s.langTileActive : {}) }}
    >
      <span style={{ ...s.langBadge, ...(o.selected ? s.langBadgeActive : {}) }}>{o.badge}</span>
      <span style={s.langTileLabel}>{o.label}</span>
    </button>
  );

  const PAPER_OPTIONS: { value: PaperFormat; label: string; description: string }[] = [
    { value: 'A4', label: t('settings.paper.a4'), description: t('settings.paper.a4_desc') },
    { value: 'LETTER', label: t('settings.paper.letter'), description: t('settings.paper.letter_desc') },
  ];

  const ROUND_MODE_OPTIONS: { value: SecondRoundMode; label: string; description: string }[] = [
    { value: 'prefilled', label: t('settings.subsequent_rounds.prefilled'), description: t('settings.subsequent_rounds.prefilled_desc') },
    { value: 'blanks', label: t('settings.subsequent_rounds.blanks'), description: t('settings.subsequent_rounds.blanks_desc') },
  ];

  const DOUBLE_CHECK_ROUND_OPTIONS: { value: DoubleCheckRound; label: string }[] = [
    { value: 'firstRound',   label: t('settings.double_check.round_first') },
    { value: 'intermediate', label: t('settings.double_check.round_second') },
    { value: 'semis',        label: t('settings.double_check.round_semis') },
    { value: 'finals',       label: t('settings.double_check.round_finals') },
  ];

  const dcOverrideCount = Object.keys(scrambleDoubleCheckOverrides).length;

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoDataUrl(null);
    setLogoName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function toggleDoubleCheckRound(round: DoubleCheckRound) {
    setScrambleDoubleCheckRounds(prev =>
      prev.includes(round) ? prev.filter(r => r !== round) : [...prev, round]
    );
  }

  function handleDcOverridesChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDcOverridesName(file.name);
    const reader = new FileReader();
    reader.onload = () => setScrambleDoubleCheckOverrides(parseDoubleCheckOverrides(reader.result as string));
    reader.readAsText(file);
  }

  function handleRemoveDcOverrides() {
    setScrambleDoubleCheckOverrides({});
    setDcOverridesName(null);
    if (dcFileInputRef.current) dcFileInputRef.current.value = '';
  }

  function addCustomEvent() {
    setCustomEvents(prev => [...prev, { name: '', iconDataUrl: null, format: 'avg5', cutoff: '', limit: '' }]);
  }

  function removeCustomEvent(i: number) {
    setCustomEvents(prev => prev.filter((_, idx) => idx !== i));
    customIconRefs.current.splice(i, 1);
  }

  function updateCustomName(i: number, name: string) {
    setCustomEvents(prev => prev.map((e, idx) => idx === i ? { ...e, name } : e));
  }

  function updateCustomIcon(i: number, iconDataUrl: string | null) {
    setCustomEvents(prev => prev.map((e, idx) => idx === i ? { ...e, iconDataUrl } : e));
  }

  function updateCustomFormat(i: number, format: 'avg5' | 'mo3') {
    setCustomEvents(prev => prev.map((e, idx) => idx === i ? { ...e, format } : e));
  }

  function updateCustomCutoff(i: number, cutoff: string) {
    setCustomEvents(prev => prev.map((e, idx) => idx === i ? { ...e, cutoff } : e));
  }

  function updateCustomLimit(i: number, limit: string) {
    setCustomEvents(prev => prev.map((e, idx) => idx === i ? { ...e, limit } : e));
  }

  function handleCustomIconUpload(i: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateCustomIcon(i, reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    const settings: CompetitionSettings = {
      competitionId,
      competitionName,
      language,
      secondaryLanguage,
      paperFormat,
      secondRoundMode,
      logoDataUrl,
      useDefaultLogo,
      wcaLiveId: wcaLiveId.trim() || null,
      wcaLivePersonIds,
      hideWcaLiveId,
      nametagLogoMode,
      nametagQrMode,
      nametagLayout,
      customEvents: customEvents.filter(e => e.name.trim()),
      scrambleDoubleCheck,
      scrambleDoubleCheckRounds,
      scrambleDoubleCheckOverrides,
      generationScope,
    };
    sessionStorage.setItem('competition_settings', JSON.stringify(settings));
    navigate('/generate');
  }

  const logoModeOptions: { value: NametTagLogoMode; label: string; description: string }[] = [
    { value: 'hidden',    label: t('settings.nametag.logo_hidden'),    description: t('settings.nametag.logo_hidden_desc') },
    { value: 'with-name', label: t('settings.nametag.logo_with_name'), description: t('settings.nametag.logo_with_name_desc') },
    { value: 'logo-only', label: t('settings.nametag.logo_only'),      description: t('settings.nametag.logo_only_desc') },
  ];

  const qrModeOptions: { value: NametTagQrMode; label: string; description: string }[] = [
    { value: 'back-only',  label: t('settings.nametag.qr_back_only'),  description: t('settings.nametag.qr_back_only_desc') },
    { value: 'both-sides', label: t('settings.nametag.qr_both_sides'), description: t('settings.nametag.qr_both_sides_desc') },
  ];


  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate('/competitions')} showSignOut />

      <main style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <div style={s.compBadge}>{competitionName}</div>
        <h2 style={s.heading}>{t('settings.heading')}</h2>

        {noGroups && <WarningBanner>{t('warnings.no_groups')}</WarningBanner>}

        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.language.title')}</h3>

          <p style={s.langCaption}>{t('settings.language.primary_title')}</p>
          <div style={s.langRow}>
            {LANGUAGES.map((opt) => renderLangTile({
              key: opt.code,
              badge: opt.code.toUpperCase(),
              label: opt.label,
              selected: language === opt.code,
              onClick: () => handlePrimaryLanguageChange(opt.code),
            }))}
          </div>

          <p style={{ ...s.langCaption, marginTop: 18 }}>{t('settings.language.secondary_title')}</p>
          <div style={s.langRow}>
            {secondaryLanguageRow(LANGUAGES, language, secondaryLanguage).map((tile, i) => {
              // Columns mirror the primary row; the column under the selected
              // primary is the "None" tile (tile.value === null).
              const lang = LANGUAGES[i];
              return renderLangTile(tile.value === null
                ? {
                    key: 'none',
                    badge: '—',
                    label: t('settings.language.secondary_none'),
                    selected: tile.selected,
                    onClick: () => setSecondaryLanguage(null),
                  }
                : {
                    key: lang.code,
                    badge: lang.code.toUpperCase(),
                    label: lang.label,
                    selected: tile.selected,
                    onClick: () => setSecondaryLanguage(tile.value),
                  });
            })}
          </div>
        </section>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.paper.title')}</h3>
          <div style={s.optionGroup}>
            {PAPER_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ ...s.optionCard, ...(paperFormat === opt.value ? s.optionCardActive : {}) }}>
                <input
                  type="radio"
                  name="paper"
                  value={opt.value}
                  checked={paperFormat === opt.value}
                  onChange={() => setPaperFormat(opt.value)}
                  style={s.radio}
                />
                <div>
                  <div style={s.optionLabel}>{opt.label}</div>
                  <div style={s.optionDesc}>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {showScorecards && showSecondRoundMode && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.subsequent_rounds.title')}</h3>
          <div style={s.optionGroup}>
            {ROUND_MODE_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ ...s.optionCard, ...(secondRoundMode === opt.value ? s.optionCardActive : {}) }}>
                <input
                  type="radio"
                  name="roundMode"
                  value={opt.value}
                  checked={secondRoundMode === opt.value}
                  onChange={() => setSecondRoundMode(opt.value)}
                  style={s.radio}
                />
                <div>
                  <div style={s.optionLabel}>{opt.label}</div>
                  <div style={s.optionDesc}>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </section>
        )}

        {showScorecards && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>
            {t('settings.double_check.title')}{' '}
            <span style={s.optional}>({t('settings.double_check.optional_note')})</span>
          </h3>
          <p style={s.hint}>{t('settings.double_check.hint')}</p>

          <label style={{ ...s.optionCard, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={scrambleDoubleCheck}
              onChange={e => setScrambleDoubleCheck(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
            />
            <div>
              <div style={s.optionLabel}>{t('settings.double_check.enable')}</div>
              <div style={s.optionDesc}>{t('settings.double_check.enable_desc')}</div>
            </div>
          </label>

          {scrambleDoubleCheck && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {t('settings.double_check.rounds_title')}
              </div>
              <div style={s.optionGroup}>
                {DOUBLE_CHECK_ROUND_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ ...s.optionCard, ...(scrambleDoubleCheckRounds.includes(opt.value) ? s.optionCardActive : {}), cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={scrambleDoubleCheckRounds.includes(opt.value)}
                      onChange={() => toggleDoubleCheckRound(opt.value)}
                      style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <div>
                      <div style={s.optionLabel}>{opt.label}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '16px 0 8px' }}>
                {t('settings.double_check.overrides_title')}
              </div>
              <p style={s.hint}>{t('settings.double_check.overrides_hint')}</p>
              {dcOverrideCount > 0 ? (
                <div style={s.logoPreview}>
                  <div style={s.logoMeta}>
                    <span style={s.logoName}>{dcOverridesName}</span>
                    <span style={s.optionDesc}>{t('settings.double_check.overrides_count', { count: dcOverrideCount })}</span>
                    <button style={s.removeBtn} onClick={handleRemoveDcOverrides}>{t('common.remove')}</button>
                  </div>
                </div>
              ) : (
                <button style={s.uploadBtn} onClick={() => dcFileInputRef.current?.click()}>
                  {t('common.choose_file')}
                </button>
              )}
              <input
                ref={dcFileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                style={{ display: 'none' }}
                onChange={handleDcOverridesChange}
              />
            </div>
          )}
        </section>
        )}

        {showScorecards && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>
            {t('settings.wca_live.title')}{' '}
            <span style={s.optional}>({t('settings.wca_live.optional_note')})</span>
            {wcaLiveFetchStatus === 'loading' && (
              <span style={s.wcaLiveLoading}> {t('settings.wca_live.fetching')}</span>
            )}
            {wcaLiveFetchStatus === 'found' && (
              <span style={s.wcaLiveFound}>
                <Check size={14} strokeWidth={2.5} /> {t('settings.wca_live.auto_detected')}
              </span>
            )}
          </h3>
          {wcaLiveFetchStatus === 'not-found' && (
            <p style={{ ...s.hint, color: 'var(--warning-text)' }}>{t('settings.wca_live.not_found')}</p>
          )}
          {wcaLiveFetchStatus !== 'not-found' && (
            <p style={s.hint}>{t('settings.wca_live.hint')}</p>
          )}
          <input
            type="text"
            inputMode="numeric"
            value={wcaLiveId}
            onChange={e => setWcaLiveId(e.target.value.replace(/\D/g, ''))}
            placeholder={t('settings.wca_live.placeholder')}
            style={s.textInput}
          />
          <label style={{ ...s.optionCard, cursor: 'pointer', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={hideWcaLiveId}
              onChange={e => setHideWcaLiveId(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
            />
            <div>
              <div style={s.optionLabel}>{t('settings.wca_live.hide_label')}</div>
              <div style={s.optionDesc}>{t('settings.wca_live.hide_desc')}</div>
            </div>
          </label>
        </section>
        )}

        <section style={s.section}>
          <h3 style={s.sectionTitle}>
            {t('settings.logo.title')}{' '}
            <span style={s.optional}>({t('settings.logo.optional_note')})</span>
          </h3>
          <p style={s.hint}>{t('settings.logo.hint')}</p>

          {logoDataUrl ? (
            <div style={s.logoPreview}>
              <img src={logoDataUrl} alt="Logo preview" style={s.logoImg} />
              <div style={s.logoMeta}>
                <span style={s.logoName}>{logoName}</span>
                <button style={s.removeBtn} onClick={handleRemoveLogo}>{t('common.remove')}</button>
              </div>
            </div>
          ) : (
            <>
              <button style={s.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                {t('common.choose_file')}
              </button>

              <label style={{ ...s.logoPreview, marginTop: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useDefaultLogo}
                  onChange={e => setUseDefaultLogo(e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
                />
                <img src={SCC_DEFAULT_LOGO} alt="Speedcubing Canada logo" style={s.logoImg} />
                <div style={s.logoMeta}>
                  <span style={s.optionLabel}>{t('settings.logo.default_title')}</span>
                  <span style={s.optionDesc}>{t('settings.logo.default_desc')}</span>
                  <span style={{ ...s.hint, margin: 0 }}>{t('settings.logo.use_default_hint')}</span>
                </div>
              </label>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleLogoChange}
          />
        </section>

        {showNametags && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.nametag.title')}</h3>

          {(logoDataUrl || useDefaultLogo) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {t('settings.nametag.logo_on_nametags')}
              </div>
              <div style={s.optionGroup}>
                {logoModeOptions.map(opt => (
                  <label key={opt.value} style={{ ...s.optionCard, ...(nametagLogoMode === opt.value ? s.optionCardActive : {}) }}>
                    <input
                      type="radio"
                      name="logoMode"
                      value={opt.value}
                      checked={nametagLogoMode === opt.value}
                      onChange={() => setNametagLogoMode(opt.value)}
                      style={s.radio}
                    />
                    <div>
                      <div style={s.optionLabel}>{opt.label}</div>
                      <div style={s.optionDesc}>{opt.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {t('settings.nametag.qr_codes')}
          </div>
          <div style={s.optionGroup}>
            {qrModeOptions.map(opt => (
              <label key={opt.value} style={{ ...s.optionCard, ...(nametagQrMode === opt.value ? s.optionCardActive : {}) }}>
                <input
                  type="radio"
                  name="qrMode"
                  value={opt.value}
                  checked={nametagQrMode === opt.value}
                  onChange={() => setNametagQrMode(opt.value)}
                  style={s.radio}
                />
                <div>
                  <div style={s.optionLabel}>{opt.label}</div>
                  <div style={s.optionDesc}>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, marginTop: 20 }}>
            {t('settings.nametag.layout')}
          </div>
          <div style={s.segmentedControl}>
            <button
              type="button"
              onClick={() => setNametagLayout('vertical')}
              aria-pressed={nametagLayout === 'vertical'}
              style={{ ...s.segment, ...(nametagLayout === 'vertical' ? s.segmentActive : s.segmentInactive) }}
            >
              <RectangleVertical size={16} strokeWidth={2} aria-hidden="true" />
              {t('settings.nametag.layout_vertical')}
            </button>
            <button
              type="button"
              onClick={() => setNametagLayout('horizontal')}
              aria-pressed={nametagLayout === 'horizontal'}
              style={{ ...s.segment, ...(nametagLayout === 'horizontal' ? s.segmentActive : s.segmentInactive) }}
            >
              <RectangleHorizontal size={16} strokeWidth={2} aria-hidden="true" />
              {t('settings.nametag.layout_horizontal')}
            </button>
          </div>
        </section>
        )}

        {everything && showScorecards && (
        <section style={s.section}>
          <button style={s.advancedToggle} onClick={() => setAdvancedOpen(o => !o)} aria-expanded={advancedOpen}>
            <span style={s.advancedToggleArrow}>
              {advancedOpen ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />}
            </span>
            {t('settings.advanced.toggle')}
          </button>

          {advancedOpen && (
            <div style={{ marginTop: 16 }}>
              <h3 style={s.sectionTitle}>
                {t('settings.advanced.custom_events_title')}{' '}
                <span style={s.optional}>({t('settings.advanced.custom_events_optional')})</span>
              </h3>
              <p style={s.hint}>{t('settings.advanced.custom_events_hint')}</p>

              {customEvents.map((custom, i) => (
                <div key={i} style={s.customEventCard}>
                  <div style={s.customEventHeader}>
                    <input
                      type="text"
                      placeholder={t('settings.advanced.event_name_placeholder')}
                      value={custom.name}
                      onChange={e => updateCustomName(i, e.target.value)}
                      style={{ ...s.textInput, flex: 1 }}
                    />
                    <button style={s.removeBtn} onClick={() => removeCustomEvent(i)}>{t('common.remove')}</button>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: isMobile ? 8 : 16, alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{t('settings.advanced.format_label')}</span>
                    {(['avg5', 'mo3'] as const).map(fmt => (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                        <input
                          type="radio"
                          checked={custom.format === fmt}
                          onChange={() => updateCustomFormat(i, fmt)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        {fmt === 'avg5' ? t('settings.advanced.avg5') : t('settings.advanced.mo3')}
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {t('settings.advanced.cutoff_label')}{' '}
                        <span style={{ color: 'var(--text-faint)' }}>({t('settings.advanced.cutoff_optional')})</span>
                      </div>
                      <input
                        type="text"
                        placeholder="M:SS"
                        value={custom.cutoff}
                        onChange={e => updateCustomCutoff(i, e.target.value)}
                        style={{ ...s.textInput, padding: '7px 10px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {t('settings.advanced.time_limit_label')}{' '}
                        <span style={{ color: 'var(--text-faint)' }}>({t('settings.advanced.time_limit_optional')})</span>
                      </div>
                      <input
                        type="text"
                        placeholder="M:SS"
                        value={custom.limit}
                        onChange={e => updateCustomLimit(i, e.target.value)}
                        style={{ ...s.textInput, padding: '7px 10px' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {t('settings.advanced.icon_hint')}
                      {custom.iconDataUrl && (
                        <button style={{ ...s.removeBtn, marginLeft: 10 }} onClick={() => updateCustomIcon(i, null)}>
                          {t('common.clear')}
                        </button>
                      )}
                    </div>
                    <div style={s.iconGrid}>
                      {Object.entries(EVENT_ICONS).map(([id, dataUrl]) => (
                        <div
                          key={id}
                          role="button"
                          tabIndex={0}
                          title={WCA_EVENT_LABELS[id] ?? id}
                          onClick={() => updateCustomIcon(i, custom.iconDataUrl === dataUrl ? null : dataUrl)}
                          onKeyDown={e => e.key === 'Enter' && updateCustomIcon(i, custom.iconDataUrl === dataUrl ? null : dataUrl)}
                          style={{
                            ...s.iconBtn,
                            ...(custom.iconDataUrl === dataUrl ? s.iconBtnActive : {}),
                          }}
                        >
                          <img src={dataUrl} alt={id} style={{ width: 20, height: 20 }} />
                          <span style={s.iconLabel}>{WCA_EVENT_LABELS[id] ?? id}</span>
                        </div>
                      ))}
                      <Tooltip label={t('settings.advanced.icon_hint')}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={t('common.upload')}
                          style={{
                            ...s.iconBtn,
                            ...(custom.iconDataUrl && !Object.values(EVENT_ICONS).includes(custom.iconDataUrl) ? s.iconBtnActive : {}),
                          }}
                          onClick={() => customIconRefs.current[i]?.click()}
                          onKeyDown={e => e.key === 'Enter' && customIconRefs.current[i]?.click()}
                        >
                          <Upload size={18} strokeWidth={2} />
                          <span style={s.iconLabel}>{t('common.upload')}</span>
                        </div>
                      </Tooltip>
                    </div>
                    <input
                      ref={el => { customIconRefs.current[i] = el; }}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleCustomIconUpload(i, e)}
                    />
                  </div>

                  {custom.iconDataUrl && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={custom.iconDataUrl} alt="selected icon" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('settings.advanced.icon_selected')}</span>
                    </div>
                  )}
                </div>
              ))}

              <button style={s.addCustomBtn} onClick={addCustomEvent}>
                {t('settings.advanced.add_custom_event')}
              </button>

            </div>
          )}
        </section>
        )}

        <div style={s.footer}>
          <button style={s.submitBtn} onClick={handleSubmit}>
            {t('settings.generate_button')}
          </button>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: 'var(--bg)' },
  main: { maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' },
  mainMobile: { padding: '24px 16px 80px' },
  compBadge: {
    display: 'inline-block', backgroundColor: 'var(--primary-soft-bg)', color: 'var(--primary-soft-text)',
    borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--fs-label)', fontWeight: 700, marginBottom: 12,
  },
  heading: { margin: '0 0 28px', fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--text)' },
  section: { marginBottom: 32 },
  sectionTitle: { margin: '0 0 12px', fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' },
  optional: { fontWeight: 400, color: 'var(--text-subtle)', fontSize: 'var(--fs-label)' },
  wcaLiveLoading: { fontWeight: 400, color: 'var(--text-subtle)', fontSize: 'var(--fs-caption)' },
  wcaLiveFound: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontWeight: 700, color: 'var(--success)', fontSize: 'var(--fs-caption)',
  },
  hint: { margin: '0 0 12px', fontSize: 'var(--fs-label)', color: 'var(--text-muted)' },
  optionGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'var(--surface)',
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px', cursor: 'pointer',
  },
  optionCardActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  radio: { marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 },
  langCaption: {
    margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  langRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  langTile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: '10px 6px', width: 78,
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 'var(--radius-lg)',
    cursor: 'pointer', backgroundColor: 'var(--surface)', userSelect: 'none',
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 120ms ease, background-color 120ms ease',
  },
  langTileActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  langBadge: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--border)', color: 'var(--text-muted)',
    fontSize: 'var(--fs-label)', fontWeight: 700, letterSpacing: '0.03em',
    transition: 'background-color 120ms ease, color 120ms ease',
  },
  langBadgeActive: { backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)' },
  langTileLabel: { fontSize: 'var(--fs-caption)', fontWeight: 500, color: 'var(--text)' },
  optionLabel: { fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  optionDesc: { fontSize: 'var(--fs-label)', color: 'var(--text-muted)' },
  logoPreview: {
    display: 'flex', alignItems: 'center', gap: 16,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px',
  },
  logoImg: { width: 64, height: 64, objectFit: 'contain', borderRadius: 'var(--radius-sm)' },
  logoMeta: { display: 'flex', flexDirection: 'column', gap: 6 },
  logoName: { fontSize: 'var(--fs-label)', color: 'var(--text-muted)' },
  removeBtn: {
    background: 'none', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
    padding: '3px 10px', fontSize: 'var(--fs-caption)', cursor: 'pointer', color: 'var(--text-muted)',
    fontFamily: 'inherit',
  },
  uploadBtn: {
    backgroundColor: 'var(--surface)', border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md)',
    padding: '14px 24px', fontSize: 'var(--fs-body)', cursor: 'pointer', color: 'var(--text-muted)',
    width: '100%', fontFamily: 'inherit',
  },
  textInput: {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: 'var(--surface)', color: 'var(--text)',
    border: '2px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: '10px 14px', fontSize: 'var(--fs-body)', fontFamily: 'inherit',
    outline: 'none',
  },
  footer: { marginTop: 40 },
  submitBtn: {
    backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)', border: 'none',
    borderRadius: 'var(--radius-md)', padding: '14px 32px', fontSize: 'var(--fs-heading)', fontWeight: 700,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit', letterSpacing: '-0.01em',
  },
  advancedToggle: {
    background: 'none', border: 'none', padding: 0,
    fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
  },
  advancedToggleArrow: { display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' },
  customEventCard: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 12,
  },
  customEventHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  iconGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  iconBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 3, padding: '5px 6px',
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', backgroundColor: 'var(--surface)',
    minWidth: 38, userSelect: 'none', outline: 'none', color: 'var(--text-muted)',
  },
  iconBtnActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  iconLabel: { fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.1' },
  segmentedControl: {
    display: 'flex',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 0',
    border: 'none',
    fontSize: 'var(--fs-label)',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  segmentActive: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-contrast)',
  },
  segmentInactive: {
    backgroundColor: 'var(--surface)',
    color: 'var(--text-muted)',
  },
  addCustomBtn: {
    backgroundColor: 'var(--surface)', border: '2px dashed var(--border-strong)',
    borderRadius: 'var(--radius-md)', padding: '10px 20px', fontSize: 'var(--fs-body)',
    cursor: 'pointer', color: 'var(--text-muted)', width: '100%',
    marginTop: 4, fontFamily: 'inherit',
  },
};
