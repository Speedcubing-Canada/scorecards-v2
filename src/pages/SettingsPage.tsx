import { useState, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CompetitionSettings, CustomEvent, Language, NametTagLogoMode, NametTagQrMode, PaperFormat, SecondRoundMode } from '../types/settings';
import { EVENT_ICONS } from '../assets/events';
import Header from '../components/Header';

const WCA_EVENT_LABELS: Record<string, string> = {
  '222': '2×2', '333': '3×3', '444': '4×4', '555': '5×5',
  '666': '6×6', '777': '7×7', '333bf': '3BLD', '333fm': 'FMC',
  '333oh': 'OH', 'clock': 'Clock', 'minx': 'Mega', 'pyram': 'Pyra',
  'skewb': 'Skewb', 'sq1': 'SQ1', '444bf': '4BLD', '555bf': '5BLD',
  '333mbf': 'MBLD',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const competitionId = sessionStorage.getItem('selected_competition_id') ?? '';
  const competitionName = sessionStorage.getItem('selected_competition_name') ?? '';

  const [language, setLanguage] = useState<Language>('bilingual-fr');
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('LETTER');
  const [secondRoundMode, setSecondRoundMode] = useState<SecondRoundMode>('prefilled');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [wcaLiveId, setWcaLiveId] = useState<string>('');
  const [nametagLogoMode, setNametagLogoMode] = useState<NametTagLogoMode>('with-name');
  const [nametagQrMode, setNametagQrMode] = useState<NametTagQrMode>('back-only');
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customIconRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!competitionId) {
    navigate('/competitions', { replace: true });
    return null;
  }

  // Option arrays defined inside component so they update when UI language changes
  const LANGUAGE_OPTIONS: { value: Language; label: string; description: string }[] = [
    { value: 'bilingual-fr', label: t('settings.language.bilingual_fr'), description: t('settings.language.bilingual_fr_desc') },
    { value: 'bilingual-en', label: t('settings.language.bilingual_en'), description: t('settings.language.bilingual_en_desc') },
    { value: 'fr', label: t('settings.language.fr'), description: t('settings.language.fr_desc') },
    { value: 'en', label: t('settings.language.en'), description: t('settings.language.en_desc') },
    { value: 'es', label: t('settings.language.es'), description: t('settings.language.es_desc') },
  ];

  const PAPER_OPTIONS: { value: PaperFormat; label: string; description: string }[] = [
    { value: 'A4', label: t('settings.paper.a4'), description: t('settings.paper.a4_desc') },
    { value: 'LETTER', label: t('settings.paper.letter'), description: t('settings.paper.letter_desc') },
  ];

  const ROUND_MODE_OPTIONS: { value: SecondRoundMode; label: string; description: string }[] = [
    { value: 'prefilled', label: t('settings.subsequent_rounds.prefilled'), description: t('settings.subsequent_rounds.prefilled_desc') },
    { value: 'blanks', label: t('settings.subsequent_rounds.blanks'), description: t('settings.subsequent_rounds.blanks_desc') },
  ];

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
      paperFormat,
      secondRoundMode,
      logoDataUrl,
      wcaLiveId: wcaLiveId.trim() || null,
      nametagLogoMode,
      nametagQrMode,
      customEvents: customEvents.filter(e => e.name.trim()),
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

      <main style={s.main}>
        <div style={s.compBadge}>{competitionName}</div>
        <h2 style={s.heading}>{t('settings.heading')}</h2>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.language.title')}</h3>
          <div style={s.optionGroup}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ ...s.optionCard, ...(language === opt.value ? s.optionCardActive : {}) }}>
                <input
                  type="radio"
                  name="language"
                  value={opt.value}
                  checked={language === opt.value}
                  onChange={() => setLanguage(opt.value)}
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

        <section style={s.section}>
          <h3 style={s.sectionTitle}>
            {t('settings.wca_live.title')}{' '}
            <span style={s.optional}>({t('settings.wca_live.optional_note')})</span>
          </h3>
          <p style={s.hint}>
            {t('settings.wca_live.hint_part1')} <strong>9667</strong>{' '}
            {t('settings.wca_live.hint_part2')}<strong>9667</strong>
            {t('settings.wca_live.hint_part3')}
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={wcaLiveId}
            onChange={e => setWcaLiveId(e.target.value.replace(/\D/g, ''))}
            placeholder={t('settings.wca_live.placeholder')}
            style={s.textInput}
          />
        </section>

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
            <button style={s.uploadBtn} onClick={() => fileInputRef.current?.click()}>
              {t('common.choose_file')}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleLogoChange}
          />
        </section>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.nametag.title')}</h3>

          {logoDataUrl && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
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

          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
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
        </section>

        <section style={s.section}>
          <button style={s.advancedToggle} onClick={() => setAdvancedOpen(o => !o)}>
            <span style={s.advancedToggleArrow}>{advancedOpen ? '▾' : '▸'}</span>
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

                  <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>{t('settings.advanced.format_label')}</span>
                    {(['avg5', 'mo3'] as const).map(fmt => (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                        <input
                          type="radio"
                          checked={custom.format === fmt}
                          onChange={() => updateCustomFormat(i, fmt)}
                          style={{ accentColor: '#003087' }}
                        />
                        {fmt === 'avg5' ? t('settings.advanced.avg5') : t('settings.advanced.mo3')}
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        {t('settings.advanced.cutoff_label')}{' '}
                        <span style={{ color: '#aaa' }}>({t('settings.advanced.cutoff_optional')})</span>
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
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        {t('settings.advanced.time_limit_label')}{' '}
                        <span style={{ color: '#aaa' }}>({t('settings.advanced.time_limit_optional')})</span>
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
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
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
                      <div
                        role="button"
                        tabIndex={0}
                        style={{
                          ...s.iconBtn,
                          ...(custom.iconDataUrl && !Object.values(EVENT_ICONS).includes(custom.iconDataUrl) ? s.iconBtnActive : {}),
                        }}
                        onClick={() => customIconRefs.current[i]?.click()}
                        onKeyDown={e => e.key === 'Enter' && customIconRefs.current[i]?.click()}
                      >
                        <span style={{ fontSize: 18, lineHeight: '20px' }}>↑</span>
                        <span style={s.iconLabel}>{t('common.upload')}</span>
                      </div>
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
                      <span style={{ fontSize: 12, color: '#555' }}>{t('settings.advanced.icon_selected')}</span>
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
  page: { minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'Helvetica, Arial, sans-serif' },
  main: { maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' },
  compBadge: {
    display: 'inline-block', backgroundColor: '#e8edf7', color: '#003087',
    borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12,
  },
  heading: { margin: '0 0 28px', fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
  section: { marginBottom: 32 },
  sectionTitle: { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  optional: { fontWeight: 400, color: '#888', fontSize: 13 },
  hint: { margin: '0 0 12px', fontSize: 13, color: '#666' },
  optionGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff',
    borderWidth: 2, borderStyle: 'solid', borderColor: '#e0e0e0',
    borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
  },
  optionCardActive: { borderColor: '#003087', backgroundColor: '#f0f4ff' },
  radio: { marginTop: 2, accentColor: '#003087', flexShrink: 0 },
  optionLabel: { fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: '#666' },
  logoPreview: {
    display: 'flex', alignItems: 'center', gap: 16,
    backgroundColor: '#fff', border: '1px solid #e0e0e0',
    borderRadius: 8, padding: '12px 16px',
  },
  logoImg: { width: 64, height: 64, objectFit: 'contain', borderRadius: 4 },
  logoMeta: { display: 'flex', flexDirection: 'column', gap: 6 },
  logoName: { fontSize: 13, color: '#444' },
  removeBtn: {
    background: 'none', border: '1px solid #ccc', borderRadius: 5,
    padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#666',
  },
  uploadBtn: {
    backgroundColor: '#fff', border: '2px dashed #ccc', borderRadius: 8,
    padding: '14px 24px', fontSize: 14, cursor: 'pointer', color: '#555',
    width: '100%',
  },
  textInput: {
    width: '100%', boxSizing: 'border-box',
    border: '2px solid #e0e0e0', borderRadius: 8,
    padding: '10px 14px', fontSize: 14, fontFamily: 'inherit',
    outline: 'none',
  },
  footer: { marginTop: 40 },
  submitBtn: {
    backgroundColor: '#003087', color: '#fff', border: 'none',
    borderRadius: 8, padding: '14px 32px', fontSize: 16, fontWeight: 600,
    cursor: 'pointer', width: '100%',
  },
  advancedToggle: {
    background: 'none', border: 'none', padding: 0,
    fontSize: 15, fontWeight: 700, color: '#1a1a1a', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  advancedToggleArrow: { fontSize: 13, color: '#555' },
  customEventCard: {
    backgroundColor: '#fff', border: '1px solid #e0e0e0',
    borderRadius: 8, padding: '14px 16px', marginBottom: 12,
  },
  customEventHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  iconGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  iconBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 3, padding: '5px 6px',
    borderWidth: 2, borderStyle: 'solid', borderColor: '#e0e0e0',
    borderRadius: 6, cursor: 'pointer', backgroundColor: '#fff',
    minWidth: 38, userSelect: 'none', outline: 'none',
  },
  iconBtnActive: { borderColor: '#003087', backgroundColor: '#f0f4ff' },
  iconLabel: { fontSize: 9, color: '#555', textAlign: 'center', lineHeight: '1.1' },
  addCustomBtn: {
    backgroundColor: '#fff', border: '2px dashed #bbb',
    borderRadius: 8, padding: '10px 20px', fontSize: 14,
    cursor: 'pointer', color: '#555', width: '100%',
    marginTop: 4,
  },
};
