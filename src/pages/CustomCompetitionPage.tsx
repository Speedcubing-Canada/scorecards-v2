import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CustomEvent } from '../types/settings';
import Header from '../components/Header';
import CustomEventEditor from '../components/CustomEventEditor';
import { useIsMobile } from '../lib/useIsMobile';

// Turn the competition name into a filename-safe id ("custom_" prefix marks the
// flow downstream). Non-ASCII-only names fall back to a fixed id.
function customCompetitionId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return slug ? `custom_${slug}` : 'custom_competition';
}

/**
 * Builder page for custom (non-WCA) competitions: name the competition and
 * define events manually. Skips /scope (there is no WCIF) and hands off to
 * /settings with the same sessionStorage contract the WCA flow uses, plus the
 * custom_competition flag that hides WCA-only settings.
 */
export default function CustomCompetitionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Survive back-navigation from /settings: reload whatever was entered before.
  const [name, setName] = useState(() =>
    sessionStorage.getItem('custom_competition') === 'true'
      ? sessionStorage.getItem('selected_competition_name') ?? ''
      : '',
  );
  const [events, setEvents] = useState<CustomEvent[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('custom_competition_events') ?? '[]') as CustomEvent[];
    } catch {
      return [];
    }
  });

  const canContinue = name.trim() !== '' && events.some(e => e.name.trim() !== '');

  function handleContinue() {
    const trimmed = name.trim();
    sessionStorage.setItem('selected_competition_id', customCompetitionId(trimmed));
    sessionStorage.setItem('selected_competition_name', trimmed);
    // No WCIF ⇒ no group detection; 'true' suppresses the no-groups warning.
    sessionStorage.setItem('competition_has_groups', 'true');
    sessionStorage.setItem('generation_scope', JSON.stringify({
      mode: 'everything',
      documents: { scorecards: true, scheduleTracker: false, nametags: false, roundChecklist: false, firstTimerSlips: false },
    }));
    sessionStorage.setItem('generation_detection', JSON.stringify({ showSecondRoundMode: false }));
    sessionStorage.setItem('custom_competition', 'true');
    sessionStorage.setItem('custom_competition_events', JSON.stringify(events.filter(e => e.name.trim() !== '')));
    navigate('/settings');
  }

  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate('/competitions')} showSignOut />

      <main style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <h2 style={s.heading}>{t('custom.heading')}</h2>
        <p style={s.hint}>{t('custom.hint')}</p>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('custom.name_label')}</h3>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('custom.name_placeholder')}
            style={s.textInput}
          />
        </section>

        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('custom.events_title')}</h3>
          <CustomEventEditor events={events} onChange={setEvents} />
        </section>

        <div style={s.footer}>
          <button
            style={{ ...s.submitBtn, ...(canContinue ? {} : s.submitBtnDisabled) }}
            disabled={!canContinue}
            onClick={handleContinue}
          >
            {t('custom.continue')}
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
  heading: { margin: '0 0 8px', fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--text)' },
  hint: { margin: '0 0 28px', fontSize: 'var(--fs-body)', color: 'var(--text-muted)' },
  section: { marginBottom: 32 },
  sectionTitle: { margin: '0 0 12px', fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' },
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
  submitBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
