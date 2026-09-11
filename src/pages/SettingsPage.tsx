import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Check, ChevronDown, ChevronRight, Info, RectangleHorizontal, RectangleVertical } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { CompetitionSettings, DoubleCheckRegionScope, DoubleCheckRound, LiveResultsMode, LocaleCode, NametTagLogoMode, NametTagQrMode, PaperFormat, ScorecardCheckMode, SecondRoundMode } from '../types/settings';
import type { GenerationScope, DocumentSelection } from '../lib/generationScope';
import { LANGUAGES } from '../i18n/index';
import { resolveDefaultPrimaryLanguage, secondaryLanguageRow, isCanadianLanguage } from '../lib/languageSelector';
import { parseDoubleCheckOverrides } from '../lib/parseDoubleCheckOverrides';
import { isChampionship } from '../lib/championship';
import Tooltip from '../components/Tooltip';
import {
  readCompetition, readCustomEvents, readDetection, readHasGroups, readIsCustom,
  readFileName, readScope, readSettings, writeCustom, writeFileName, writeSettings,
} from '../lib/flowState';
import { readPresetSettings } from '../presets';
import { SCC_DEFAULT_LOGO } from '../assets/scc-logo';
import Header from '../components/Header';
import WarningBanner from '../components/WarningBanner';
import CustomEventEditor from '../components/CustomEventEditor';
import { useIsMobile } from '../lib/useIsMobile';
import { fetchScoretakingSoftware, fetchWcaLiveId, fetchWcaLivePersonIds } from '../auth/wca';
import { useAuth } from '../auth/useAuth';

// Where each ranking rule lands when it is ticked. 50 is the world top the regulation names;
// 1 is the national/continental record holder, who a world-50 threshold misses in a small region.
const DC_WORLD_TOP_DEFAULT = 50;
const DC_REGION_TOP_DEFAULT = 1;

/**
 * `CompetitionSettings` minus the four values the flow owns. Derived with Omit so a new
 * field is a type error here until it is given an initial value.
 */
type SettingsDraft = Omit<
  CompetitionSettings,
  'competitionId' | 'competitionName' | 'generationScope' | 'isCustomCompetition'
>;

/**
 * Seeds the form from a stored blob. `wcaLiveId` normalises back to `''`: `handleSubmit`
 * writes `null` for an empty one, and `null` would make the input uncontrolled.
 */
function restorableSettings(previous: CompetitionSettings | null): Partial<SettingsDraft> {
  if (!previous) return {};
  const rest: Partial<CompetitionSettings> = { ...previous };
  delete rest.competitionId;
  delete rest.competitionName;
  delete rest.generationScope;
  delete rest.isCustomCompetition;
  // Older blobs carry `false` and no control is left to undo that.
  delete rest.scrambleDoubleCheck;
  return { ...rest, wcaLiveId: rest.wcaLiveId ?? '' };
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { token } = useAuth();

  const { id: competitionId, name: competitionName } = readCompetition();
  // Custom (non-WCA) competition: no WCIF, no WCA Live, events defined on /custom.
  const isCustom = readIsCustom();
  // Set on the scope step. No groups yet means scorecard counts read 0, so warn.
  const noGroups = !readHasGroups();

  // Scorecards-only (scope ≠ everything) hides everything not about scorecards.
  const generationScope: GenerationScope = readScope();
  const everything = generationScope.mode === 'everything';
  const docs = (generationScope as { documents?: DocumentSelection }).documents;
  const showScorecards = docs?.scorecards !== false;
  const showNametags   = docs?.nametags   !== false;
  const { showSecondRoundMode } = readDetection();

  // Primary follows the interface language; secondary starts at None so single-language
  // users have nothing to clear.
  const defaultPrimary = resolveDefaultPrimaryLanguage(
    i18n.resolvedLanguage ?? i18n.language,
    LANGUAGES,
  );

  // A preset seeds initial values only; nothing is locked, and `{}` means plain defaults.
  const preset = readPresetSettings();

  // Spread over the defaults rather than replacing them, so a field added since the blob was
  // written still gets its initial value. /scope drops the blob when the preset changes.
  const previous = readSettings();

  // Exactly the mutable half of CompetitionSettings, so `handleSubmit` is a spread plus the
  // four flow-owned values and a new setting cannot be forgotten there.
  const [draft, setDraft] = useState<SettingsDraft>(() => ({
    language: preset.language ?? defaultPrimary,
    secondaryLanguage: preset.secondaryLanguage ?? null,
    paperFormat: preset.paperFormat ?? 'LETTER',
    secondRoundMode: preset.secondRoundMode ?? 'prefilled',
    logoDataUrl: null,
    useDefaultLogo: preset.useDefaultLogo ?? isCanadianLanguage(i18n.resolvedLanguage ?? i18n.language),
    // Overwritten on mount by the competition's own setting, unless modeTouched.
    liveResultsMode: 'wca-live',
    wcaLiveId: '',
    wcaLivePersonIds: null,
    hideWcaLiveId: preset.hideWcaLiveId ?? false,
    nametagLogoMode: preset.nametagLogoMode ?? 'with-name',
    nametagQrMode: preset.nametagQrMode ?? 'back-only',
    nametagLayout: preset.nametagLayout ?? 'vertical',
    scorecardCheckMode: preset.scorecardCheckMode ?? 'per-group-card',
    // Regulation 11i binds every competition, so there is no switch: "off" is both ranking
    // rules unticked with no round or CSV rule. A whole round is only worth double-checking
    // at a championship, whose finals 11i1f singles out.
    scrambleDoubleCheck: true,
    scrambleDoubleCheckRounds: isChampionship(competitionName) ? ['finals'] : [],
    scrambleDoubleCheckOverrides: {},
    scrambleDoubleCheckWorldTop: DC_WORLD_TOP_DEFAULT,
    scrambleDoubleCheckRegionTop: null,
    scrambleDoubleCheckRegionScope: 'national',
    customEvents: [],
    ...restorableSettings(previous),
    // A custom competition's events live in their own key, which /custom may have changed
    // since this blob was written. A WCA competition's live only in the blob.
    ...(isCustom ? { customEvents: readCustomEvents() } : {}),
  }));

  const patch = (fields: Partial<SettingsDraft>) => setDraft(d => ({ ...d, ...fields }));

  const {
    language, secondaryLanguage, paperFormat, secondRoundMode, logoDataUrl, useDefaultLogo,
    liveResultsMode, wcaLiveId, hideWcaLiveId, nametagLogoMode, nametagQrMode, nametagLayout,
    scorecardCheckMode, customEvents, scrambleDoubleCheckRounds,
    scrambleDoubleCheckOverrides, scrambleDoubleCheckWorldTop, scrambleDoubleCheckRegionTop,
    scrambleDoubleCheckRegionScope,
  } = draft;

  // Not part of the draft, but stored so a restored upload isn't nameless.
  const [logoName, setLogoName] = useState<string | null>(() => readFileName('logo'));
  const [wcaLiveFetchStatus, setWcaLiveFetchStatus] = useState<'loading' | 'found' | 'not-found'>('loading');
  // A restored or hand-picked choice beats the WCA record, which may not be updated yet.
  const [modeTouched, setModeTouched] = useState(previous?.liveResultsMode !== undefined);
  // A restored custom event behind a collapsed section reads as lost.
  const [advancedOpen, setAdvancedOpen] = useState(
    customEvents.length > 0 || Object.keys(scrambleDoubleCheckOverrides).length > 0,
  );
  const [dcOverridesName, setDcOverridesName] = useState<string | null>(() => readFileName('dcOverrides'));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dcFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Custom competitions are unofficial - they run on neither live-results system.
    if (!competitionId || isCustom) return;
    (async () => {
      const scoretaking = await fetchScoretakingSoftware(competitionId, token?.access_token);
      // ILR builds its URLs from ids already in hand; nothing to look up on WCA Live.
      if (scoretaking === 'internal' && !modeTouched) {
        patch({ liveResultsMode: 'ilr' });
        return;
      }
      const id = await fetchWcaLiveId(competitionId);
      if (!id) {
        setWcaLiveFetchStatus('not-found');
        return;
      }
      // Only fill an empty field: a restored or hand-typed id is the organizer's.
      setDraft(d => (d.wcaLiveId ? d : { ...d, wcaLiveId: id }));
      setWcaLiveFetchStatus('found');
      patch({ wcaLivePersonIds: await fetchWcaLivePersonIds(id) });
    })();
  // competitionId is stable (from sessionStorage), no deps needed beyond mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!competitionId) {
    navigate('/competitions', { replace: true });
    return null;
  }

  // Driven by the shared LANGUAGES registry, so adding a language needs no strings here.
  // Both rows share fixed columns; the column under the primary becomes the "None" tile,
  // so nothing ever shifts.
  function handlePrimaryLanguageChange(code: LocaleCode) {
    // One language must never appear on both sides.
    patch({ language: code, ...(secondaryLanguage === code ? { secondaryLanguage: null } : {}) });
  }

  // Monogram badge + native label, in the spirit of an event-icon selector.
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

  const DOUBLE_CHECK_REGION_OPTIONS: { value: DoubleCheckRegionScope; label: string }[] = [
    { value: 'national',    label: t('settings.double_check.ranking_scope_national') },
    { value: 'continental', label: t('settings.double_check.ranking_scope_continental') },
  ];

  const dcOverrideCount = Object.keys(scrambleDoubleCheckOverrides).length;

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => patch({ logoDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    patch({ logoDataUrl: null });
    setLogoName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function toggleDoubleCheckRound(round: DoubleCheckRound) {
    setDraft(d => ({
      ...d,
      scrambleDoubleCheckRounds: d.scrambleDoubleCheckRounds.includes(round)
        ? d.scrambleDoubleCheckRounds.filter(r => r !== round)
        : [...d.scrambleDoubleCheckRounds, round],
    }));
  }

  // Off when the threshold is null. Ticking restores the default, not the last value.
  function toggleDcRankingRule(key: 'scrambleDoubleCheckWorldTop' | 'scrambleDoubleCheckRegionTop') {
    const fallback = key === 'scrambleDoubleCheckWorldTop' ? DC_WORLD_TOP_DEFAULT : DC_REGION_TOP_DEFAULT;
    setDraft(d => ({ ...d, [key]: d[key] === null ? fallback : null }));
  }

  // Digits only. An emptied box holds 0 (matching nobody) while typing and snaps back to the
  // default on blur, so it can never be saved blank.
  function setDcRankingTop(
    key: 'scrambleDoubleCheckWorldTop' | 'scrambleDoubleCheckRegionTop',
    raw: string,
  ) {
    patch({ [key]: Number(raw.replace(/\D/g, '').slice(0, 5)) });
  }

  function normalizeDcRankingTop(key: 'scrambleDoubleCheckWorldTop' | 'scrambleDoubleCheckRegionTop') {
    const fallback = key === 'scrambleDoubleCheckWorldTop' ? DC_WORLD_TOP_DEFAULT : DC_REGION_TOP_DEFAULT;
    setDraft(d => (d[key] === 0 ? { ...d, [key]: fallback } : d));
  }

  function handleDcOverridesChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDcOverridesName(file.name);
    const reader = new FileReader();
    reader.onload = () => patch({ scrambleDoubleCheckOverrides: parseDoubleCheckOverrides(reader.result as string) });
    reader.readAsText(file);
  }

  function handleRemoveDcOverrides() {
    patch({ scrambleDoubleCheckOverrides: {} });
    setDcOverridesName(null);
    if (dcFileInputRef.current) dcFileInputRef.current.value = '';
  }

  function handleSubmit() {
    writeFileName('logo', logoName);
    writeFileName('dcOverrides', dcOverridesName);
    // Write them back so /custom and the restore above see them.
    if (isCustom) writeCustom(draft.customEvents.filter(e => e.name.trim()));
    writeSettings({
      ...draft,
      competitionId,
      competitionName,
      generationScope,
      isCustomCompetition: isCustom,
      customEvents: draft.customEvents.filter(e => e.name.trim()),
      // Unofficial: no live results, no double-checking, no "WCA Live:" line.
      liveResultsMode: isCustom ? 'wca-live' : draft.liveResultsMode,
      wcaLiveId: isCustom ? null : (draft.wcaLiveId?.trim() || null),
      wcaLivePersonIds: isCustom ? null : draft.wcaLivePersonIds,
      hideWcaLiveId: isCustom ? true : draft.hideWcaLiveId,
      scrambleDoubleCheck: !isCustom,
    });
    navigate('/generate');
  }

  const liveModeOptions: { value: LiveResultsMode; label: string; description: string }[] = [
    { value: 'wca-live', label: t('settings.wca_live.mode_wca_live'), description: t('settings.wca_live.mode_wca_live_desc') },
    { value: 'ilr',      label: t('settings.wca_live.mode_ilr'),      description: t('settings.wca_live.mode_ilr_desc') },
  ];

  const logoModeOptions: { value: NametTagLogoMode; label: string; description: string }[] = [
    { value: 'hidden',    label: t('settings.nametag.logo_hidden'),    description: t('settings.nametag.logo_hidden_desc') },
    { value: 'with-name', label: t('settings.nametag.logo_with_name'), description: t('settings.nametag.logo_with_name_desc') },
    { value: 'logo-only', label: t('settings.nametag.logo_only'),      description: t('settings.nametag.logo_only_desc') },
  ];

  const qrModeOptions: { value: NametTagQrMode; label: string; description: string }[] = [
    { value: 'back-only',  label: t('settings.nametag.qr_back_only'),  description: t('settings.nametag.qr_back_only_desc') },
    { value: 'both-sides', label: t('settings.nametag.qr_both_sides'), description: t('settings.nametag.qr_both_sides_desc') },
  ];

  const checkModeOptions: { value: ScorecardCheckMode; label: string; description: string }[] = [
    { value: 'per-group-card', label: t('settings.check_mode.per_group'),      description: t('settings.check_mode.per_group_desc') },
    { value: 'per-round-card', label: t('settings.check_mode.per_round'),      description: t('settings.check_mode.per_round_desc') },
    { value: 'none',           label: t('settings.check_mode.none'),           description: t('settings.check_mode.none_desc') },
  ];


  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate(isCustom ? '/custom' : '/scope')} showSignOut />

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
              // The column under the selected primary is the "None" tile.
              const lang = LANGUAGES[i];
              return renderLangTile(tile.value === null
                ? {
                    key: 'none',
                    badge: '-',
                    label: t('settings.language.secondary_none'),
                    selected: tile.selected,
                    onClick: () => patch({ secondaryLanguage: null }),
                  }
                : {
                    key: lang.code,
                    badge: lang.code.toUpperCase(),
                    label: lang.label,
                    selected: tile.selected,
                    onClick: () => patch({ secondaryLanguage: tile.value }),
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
                  onChange={() => patch({ paperFormat: opt.value })}
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
                  onChange={() => patch({ secondRoundMode: opt.value })}
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

        {showScorecards && !isCustom && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.check_mode.title')}</h3>
          <p style={s.hint}>{t('settings.check_mode.hint')}</p>
          <div style={s.optionGroup}>
            {checkModeOptions.map(opt => (
              <label key={opt.value} style={{ ...s.optionCard, ...(scorecardCheckMode === opt.value ? s.optionCardActive : {}) }}>
                <input
                  type="radio"
                  name="checkMode"
                  value={opt.value}
                  checked={scorecardCheckMode === opt.value}
                  onChange={() => patch({ scorecardCheckMode: opt.value })}
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

        {(showScorecards || showNametags) && !isCustom && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.wca_live.system_title')}</h3>
          {/* Only the name tag QR codes read the system and the id. The scorecard checkbox
              below is about the printed "WCA Live:" line, which exists in either system. */}
          {showNametags && (<>
          <p style={s.hint}>{t('settings.wca_live.system_hint')}</p>
          <div style={s.optionGroup}>
            {liveModeOptions.map(opt => (
              <label key={opt.value} style={{ ...s.optionCard, ...(liveResultsMode === opt.value ? s.optionCardActive : {}) }}>
                <input
                  type="radio"
                  name="liveResultsMode"
                  value={opt.value}
                  checked={liveResultsMode === opt.value}
                  onChange={() => { setModeTouched(true); patch({ liveResultsMode: opt.value }); }}
                  style={s.radio}
                />
                <div>
                  <div style={s.optionLabel}>{opt.label}</div>
                  <div style={s.optionDesc}>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>

          {/* ILR needs no id: its URLs are built from the WCA competition id we already have. */}
          {liveResultsMode === 'wca-live' && (<>
          <h3 style={{ ...s.sectionTitle, marginTop: 20 }}>
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
            value={wcaLiveId ?? ''}
            onChange={e => patch({ wcaLiveId: e.target.value.replace(/\D/g, '') })}
            placeholder={t('settings.wca_live.placeholder')}
            style={s.textInput}
          />
          </>)}
          </>)}
          {showScorecards && (
          <label style={{ ...s.optionCard, cursor: 'pointer', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={hideWcaLiveId}
              onChange={e => patch({ hideWcaLiveId: e.target.checked })}
              style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
            />
            <div>
              <div style={s.optionLabel}>{t('settings.wca_live.hide_label')}</div>
              <div style={s.optionDesc}>{t('settings.wca_live.hide_desc')}</div>
            </div>
          </label>
          )}
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
                  onChange={e => patch({ useDefaultLogo: e.target.checked })}
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
                      onChange={() => patch({ nametagLogoMode: opt.value })}
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
                  onChange={() => patch({ nametagQrMode: opt.value })}
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
              onClick={() => patch({ nametagLayout: 'vertical' })}
              aria-pressed={nametagLayout === 'vertical'}
              style={{ ...s.segment, ...(nametagLayout === 'vertical' ? s.segmentActive : s.segmentInactive) }}
            >
              <RectangleVertical size={16} strokeWidth={2} aria-hidden="true" />
              {t('settings.nametag.layout_vertical')}
            </button>
            <button
              type="button"
              onClick={() => patch({ nametagLayout: 'horizontal' })}
              aria-pressed={nametagLayout === 'horizontal'}
              style={{ ...s.segment, ...(nametagLayout === 'horizontal' ? s.segmentActive : s.segmentInactive) }}
            >
              <RectangleHorizontal size={16} strokeWidth={2} aria-hidden="true" />
              {t('settings.nametag.layout_horizontal')}
            </button>
          </div>
        </section>
        )}

        {showScorecards && !isCustom && (
        <section style={s.section}>
          <button style={s.advancedToggle} onClick={() => setAdvancedOpen(o => !o)} aria-expanded={advancedOpen}>
            <span style={s.advancedToggleArrow}>
              {advancedOpen ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />}
            </span>
            {t('settings.advanced.toggle')}
          </button>

          {advancedOpen && (
            <div style={{ marginTop: 16 }}>
              <h3 style={s.sectionTitle}>{t('settings.double_check.title')}</h3>
              <p style={s.hint}>{t('settings.double_check.hint')}</p>

              <div style={{ ...s.subheading, marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('settings.double_check.ranking_title')}
                <Tooltip label={t('settings.double_check.ranking_tooltip')}>
                  <span
                    tabIndex={0}
                    aria-label={t('settings.double_check.ranking_tooltip')}
                    style={s.infoIcon}
                  >
                    <Info size={14} strokeWidth={2} aria-hidden="true" />
                  </span>
                </Tooltip>
              </div>
              <p style={s.hint}>{t('settings.double_check.ranking_hint')}</p>

              <div style={s.optionGroup}>
                <div style={{ ...s.optionCard, ...(scrambleDoubleCheckWorldTop !== null ? s.optionCardActive : {}), alignItems: 'center' }}>
                  <label style={s.rankingRule}>
                    <input
                      type="checkbox"
                      checked={scrambleDoubleCheckWorldTop !== null}
                      onChange={() => toggleDcRankingRule('scrambleDoubleCheckWorldTop')}
                      style={{ accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <span style={s.optionLabel}>{t('settings.double_check.ranking_world')}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={scrambleDoubleCheckWorldTop ?? ''}
                    disabled={scrambleDoubleCheckWorldTop === null}
                    aria-label={t('settings.double_check.ranking_world')}
                    onChange={e => setDcRankingTop('scrambleDoubleCheckWorldTop', e.target.value)}
                    onBlur={() => normalizeDcRankingTop('scrambleDoubleCheckWorldTop')}
                    style={s.rankingInput}
                  />
                </div>

                <div style={{ ...s.optionCard, ...(scrambleDoubleCheckRegionTop !== null ? s.optionCardActive : {}), alignItems: 'center' }}>
                  <label style={s.rankingRule}>
                    <input
                      type="checkbox"
                      checked={scrambleDoubleCheckRegionTop !== null}
                      onChange={() => toggleDcRankingRule('scrambleDoubleCheckRegionTop')}
                      style={{ accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <span style={s.optionLabel}>{t('settings.double_check.ranking_region')}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={scrambleDoubleCheckRegionTop ?? ''}
                    disabled={scrambleDoubleCheckRegionTop === null}
                    aria-label={t('settings.double_check.ranking_region')}
                    onChange={e => setDcRankingTop('scrambleDoubleCheckRegionTop', e.target.value)}
                    onBlur={() => normalizeDcRankingTop('scrambleDoubleCheckRegionTop')}
                    style={s.rankingInput}
                  />
                </div>
              </div>

              {scrambleDoubleCheckRegionTop !== null && (
                <div style={{ ...s.segmentedControl, marginTop: 8 }}>
                  {DOUBLE_CHECK_REGION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ scrambleDoubleCheckRegionScope: opt.value })}
                      aria-pressed={scrambleDoubleCheckRegionScope === opt.value}
                      style={{ ...s.segment, ...(scrambleDoubleCheckRegionScope === opt.value ? s.segmentActive : s.segmentInactive) }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <div style={s.subheading}>
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

              <div style={s.subheading}>
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

              {everything && (
                <>
                  <h3 style={{ ...s.sectionTitle, marginTop: 28 }}>
                    {t('settings.advanced.custom_events_title')}{' '}
                    <span style={s.optional}>({t('settings.advanced.custom_events_optional')})</span>
                  </h3>
                  <p style={s.hint}>{t('settings.advanced.custom_events_hint')}</p>

                  <CustomEventEditor events={customEvents} onChange={events => patch({ customEvents: events })} />
                </>
              )}
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
  subheading: { fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '16px 0 8px' },
  infoIcon: { display: 'inline-flex', color: 'var(--text-muted)', cursor: 'help' },
  // The threshold input is its sibling, so each label owns exactly one control.
  rankingRule: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' },
  rankingInput: {
    width: 72, boxSizing: 'border-box',
    backgroundColor: 'var(--surface)', color: 'var(--text)',
    border: '2px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: '6px 10px', fontSize: 'var(--fs-body)', fontFamily: 'inherit',
    outline: 'none', textAlign: 'center',
  },
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
};
