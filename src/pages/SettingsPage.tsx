import { useState, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { CompetitionSettings, CustomEvent, Language, NametTagLogoMode, NametTagQrMode, PaperFormat, SecondRoundMode } from '../types/settings';
import { EVENT_ICONS } from '../assets/events';

const WCA_EVENT_LABELS: Record<string, string> = {
  '222': '2×2', '333': '3×3', '444': '4×4', '555': '5×5',
  '666': '6×6', '777': '7×7', '333bf': '3BLD', '333fm': 'FMC',
  '333oh': 'OH', 'clock': 'Clock', 'minx': 'Mega', 'pyram': 'Pyra',
  'skewb': 'Skewb', 'sq1': 'SQ1', '444bf': '4BLD', '555bf': '5BLD',
  '333mbf': 'MBLD',
};

const LANGUAGE_OPTIONS: { value: Language; label: string; description: string }[] = [
  { value: 'bilingual-fr', label: 'Bilingual — French main', description: 'French first, English second (CQ, QO, etc.)' },
  { value: 'bilingual-en', label: 'Bilingual — English main', description: 'English first, French second' },
  { value: 'fr', label: 'French only', description: 'All text in French' },
  { value: 'en', label: 'English only', description: 'All text in English' },
];

const PAPER_OPTIONS: { value: PaperFormat; label: string; description: string }[] = [
  { value: 'A4', label: 'A4', description: '210 × 297 mm — each scorecard is A6 (105 × 148.5 mm)' },
  { value: 'LETTER', label: 'Letter', description: '8.5 × 11 in — each scorecard is 107.95 × 139.7 mm' },
];

const ROUND_MODE_OPTIONS: { value: SecondRoundMode; label: string; description: string }[] = [
  { value: 'prefilled', label: 'Pre-filled with names', description: 'Print scorecards for all qualifiers (requires WCA Live results)' },
  { value: 'blanks', label: 'Event + round filled, name blank', description: 'Print blank name slots — fill in by hand at the competition' },
];

export default function SettingsPage() {
  const { logout } = useAuth();
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

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => navigate('/competitions')}>← Back</button>
        <span style={s.headerTitle}>Settings</span>
        <button style={s.logoutBtn} onClick={logout}>Sign out</button>
      </header>

      <main style={s.main}>
        <div style={s.compBadge}>{competitionName}</div>
        <h2 style={s.heading}>Configure your print settings</h2>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>Language</h3>
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
          <h3 style={s.sectionTitle}>Paper format</h3>
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
          <h3 style={s.sectionTitle}>Subsequent rounds</h3>
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
          <h3 style={s.sectionTitle}>WCA Live ID <span style={s.optional}>(optional — for nametag QR codes)</span></h3>
          <p style={s.hint}>
            The numeric competition ID from WCA Live (e.g. <strong>9667</strong> from
            {' '}live.worldcubeassociation.org/competitions/<strong>9667</strong>).
            Used to generate competitor-specific WCA Live QR codes on name tags.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={wcaLiveId}
            onChange={e => setWcaLiveId(e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 9667"
            style={s.textInput}
          />
        </section>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>Competition logo <span style={s.optional}>(optional)</span></h3>
          <p style={s.hint}>Appears in the top-left corner of each scorecard. PNG or SVG recommended.</p>

          {logoDataUrl ? (
            <div style={s.logoPreview}>
              <img src={logoDataUrl} alt="Logo preview" style={s.logoImg} />
              <div style={s.logoMeta}>
                <span style={s.logoName}>{logoName}</span>
                <button style={s.removeBtn} onClick={handleRemoveLogo}>Remove</button>
              </div>
            </div>
          ) : (
            <button style={s.uploadBtn} onClick={() => fileInputRef.current?.click()}>
              Choose file
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
          <h3 style={s.sectionTitle}>Name tag layout</h3>

          {logoDataUrl && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
                Logo on name tags
              </div>
              <div style={s.optionGroup}>
                {([
                  { value: 'hidden'    as const, label: 'Hidden',                    description: 'Logo not shown on name tags' },
                  { value: 'with-name' as const, label: 'Small logo + comp name',    description: 'Small logo beside the competition name at the top of each panel' },
                  { value: 'logo-only' as const, label: 'Large logo, replaces name', description: 'Logo replaces the competition name text — QR codes are slightly smaller to compensate' },
                ]).map(opt => (
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
            QR codes
          </div>
          <div style={s.optionGroup}>
            {([
              { value: 'back-only' as const, label: 'Back side only', description: 'Front = group assignments (FR), back = QR codes (EN)' },
              { value: 'both-sides' as const, label: 'Both sides', description: 'QR codes on both front and back — useful when logo takes space' },
            ]).map(opt => (
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
            Advanced
          </button>

          {advancedOpen && (
            <div style={{ marginTop: 16 }}>
              <h3 style={s.sectionTitle}>Custom events <span style={s.optional}>(optional)</span></h3>
              <p style={s.hint}>
                Print 4 blank scorecards for side events or bonus puzzles not listed in the WCIF.
                Group and round fields will be left blank.
              </p>

              {customEvents.map((custom, i) => (
                <div key={i} style={s.customEventCard}>
                  <div style={s.customEventHeader}>
                    <input
                      type="text"
                      placeholder="Event name (e.g. Clock Relay)"
                      value={custom.name}
                      onChange={e => updateCustomName(i, e.target.value)}
                      style={{ ...s.textInput, flex: 1 }}
                    />
                    <button style={s.removeBtn} onClick={() => removeCustomEvent(i)}>Remove</button>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>Format</span>
                    {(['avg5', 'mo3'] as const).map(fmt => (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                        <input
                          type="radio"
                          checked={custom.format === fmt}
                          onChange={() => updateCustomFormat(i, fmt)}
                          style={{ accentColor: '#003087' }}
                        />
                        {fmt === 'avg5' ? 'Average of 5' : 'Mean of 3'}
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Cutoff <span style={{ color: '#aaa' }}>(optional, e.g. 1:30)</span></div>
                      <input
                        type="text"
                        placeholder="M:SS"
                        value={custom.cutoff}
                        onChange={e => updateCustomCutoff(i, e.target.value)}
                        style={{ ...s.textInput, padding: '7px 10px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Time limit <span style={{ color: '#aaa' }}>(optional, e.g. 10:00)</span></div>
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
                      Icon — click a WCA icon or upload your own
                      {custom.iconDataUrl && (
                        <button style={{ ...s.removeBtn, marginLeft: 10 }} onClick={() => updateCustomIcon(i, null)}>
                          Clear
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
                        <span style={s.iconLabel}>Upload</span>
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
                      <span style={{ fontSize: 12, color: '#555' }}>Selected icon</span>
                    </div>
                  )}
                </div>
              ))}

              <button style={s.addCustomBtn} onClick={addCustomEvent}>
                + Add custom event
              </button>
            </div>
          )}
        </section>

        <div style={s.footer}>
          <button style={s.submitBtn} onClick={handleSubmit}>
            Generate →
          </button>
        </div>
      </main>
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
  headerTitle: { fontSize: 16, fontWeight: 700 },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer',
  },
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
