import { useState, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { CompetitionSettings, Language, PaperFormat, SecondRoundMode } from '../types/settings';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleSubmit() {
    const settings: CompetitionSettings = {
      competitionId,
      competitionName,
      language,
      paperFormat,
      secondRoundMode,
      logoDataUrl,
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
    backgroundColor: '#fff', border: '2px solid #e0e0e0',
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
  footer: { marginTop: 40 },
  submitBtn: {
    backgroundColor: '#003087', color: '#fff', border: 'none',
    borderRadius: 8, padding: '14px 32px', fontSize: 16, fontWeight: 600,
    cursor: 'pointer', width: '100%',
  },
};
