import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../lib/useIsMobile';

/**
 * "About this tool" explainer. Renders a trigger (a small circular "i" button, or a
 * text link when `as="text"`) that opens a modal describing what the tool is, the WCIF
 * concept, and where it sits in the competition workflow. Self-contained open state so
 * it can be dropped onto any page (used on the login and competition-picker pages).
 */
export default function AboutDialog({ as = 'icon' }: { as?: 'icon' | 'text' }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {as === 'text' ? (
        <button style={s.textTrigger} onClick={() => setOpen(true)}>
          {t('about.trigger')}
        </button>
      ) : (
        <button style={s.iconTrigger} aria-label={t('about.trigger')} onClick={() => setOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="11" x2="12" y2="16" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      )}

      {open && (
        <div style={s.overlay} onMouseDown={() => setOpen(false)}>
          <div
            style={{ ...s.card, ...(isMobile ? s.cardMobile : {}) }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 style={s.title}>{t('about.title')}</h2>
            <p style={s.body}>{t('about.intro')}</p>

            <h3 style={s.section}>{t('about.wcif_title')}</h3>
            <p style={s.body}>{t('about.wcif_body')}</p>

            <h3 style={s.section}>{t('about.workflow_title')}</h3>
            <p style={s.body}>{t('about.workflow_body')}</p>

            <button style={s.close} onClick={() => setOpen(false)}>{t('about.close')}</button>
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  iconTrigger: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0,
    background: 'none', border: 'none', borderRadius: '50%',
    color: 'var(--text-muted)', cursor: 'pointer',
  },
  textTrigger: {
    background: 'none', border: 'none', padding: 0,
    color: 'var(--text-muted)', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, textDecoration: 'underline',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'var(--surface)', color: 'var(--text)',
    borderRadius: 12, boxShadow: 'var(--shadow-lg)',
    padding: '32px 36px', maxWidth: 520, width: '100%',
    maxHeight: '85vh', overflowY: 'auto', textAlign: 'left',
  },
  cardMobile: { padding: '24px 20px' },
  title: { margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: 'var(--text)' },
  section: { margin: '20px 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  body: { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' },
  close: {
    marginTop: 24,
    backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 8, padding: '12px 20px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  },
};
