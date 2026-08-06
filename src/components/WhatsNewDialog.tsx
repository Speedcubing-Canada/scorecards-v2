import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHANGELOG, isStale, markAllSeen, readSeen, unseenEntries } from '../changelog';
import type { LocaleCode } from '../types/settings';
import { useIsMobile } from '../lib/useIsMobile';
import Tooltip from './Tooltip';

/** Never more than this many batches at once — it's a quick summary, not a release history. */
const MAX_ENTRIES = 3;

/**
 * "What's new since your last visit". Lives in the Header, so it never appears before sign-in.
 * Opens by itself when there are entries newer than the marker in localStorage, and closing it
 * marks everything read — the Header remounts on every page, but the dialog only shows once.
 * The sparkles trigger stays available afterwards to read the latest entries again, until the
 * newest entry passes a year old — see `isStale`, after which the whole thing disappears.
 */
export default function WhatsNewDialog() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [unseen, setUnseen] = useState(() => unseenEntries(readSeen()));
  const [open, setOpen] = useState(() => unseen.length > 0);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close() {
    markAllSeen();
    setUnseen([]);
    setOpen(false);
  }

  // Nothing shipped in over a year: the changelog is history, not news. Hide it outright.
  if (isStale()) return null;

  const entries = (unseen.length > 0 ? unseen : CHANGELOG).slice(0, MAX_ENTRIES);
  const locale = i18n.language.split('-')[0] as LocaleCode;

  return (
    <>
      <Tooltip label={t('whats_new.trigger')} placement="bottom">
        <button style={s.trigger} aria-label={t('whats_new.trigger')} onClick={() => setOpen(true)}>
          <Sparkles size={18} strokeWidth={2} />
          {unseen.length > 0 && <span style={s.dot} />}
        </button>
      </Tooltip>

      {open && (
        <div style={s.overlay} onMouseDown={close}>
          <div
            style={{ ...s.card, ...(isMobile ? s.cardMobile : {}) }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 style={s.title}>{t('whats_new.title')}</h2>
            <p style={s.subtitle}>{t('whats_new.subtitle')}</p>

            {entries.map((entry) => (
              <div key={entry.id}>
                <h3 style={s.date}>
                  {new Date(`${entry.id.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <ul style={s.list}>
                  {(entry.items[locale] ?? entry.items.en).map((item) => (
                    <li key={item} style={s.item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            <button style={s.close} onClick={close}>{t('whats_new.close')}</button>
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    position: 'relative',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0,
    background: 'none', border: 'none', borderRadius: '50%',
    color: 'var(--text-muted)', cursor: 'pointer',
  },
  dot: {
    position: 'absolute', top: 2, right: 2,
    width: 7, height: 7, borderRadius: '50%',
    backgroundColor: 'var(--primary)',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'var(--space-6)',
  },
  card: {
    backgroundColor: 'var(--surface)', color: 'var(--text)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
    padding: '32px 36px', maxWidth: 520, width: '100%',
    maxHeight: '85vh', overflowY: 'auto', textAlign: 'left',
  },
  cardMobile: { padding: '24px 20px' },
  title: { margin: '0 0 4px', fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' },
  subtitle: { margin: 0, fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--text-subtle)' },
  date: { margin: '20px 0 6px', fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text)' },
  list: { margin: 0, paddingLeft: 'var(--space-5)' },
  item: {
    margin: '0 0 var(--space-2)',
    fontSize: 'var(--fs-body)', fontWeight: 400, lineHeight: 1.6, color: 'var(--text-muted)',
  },
  close: {
    marginTop: 'var(--space-6)',
    backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 'var(--radius-md)', padding: '12px 20px',
    fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  },
};
