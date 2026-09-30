import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHANGELOG, isStale, markAllSeen, readSeen, unseenEntries } from '../changelog';
import type { LocaleCode } from '../types/settings';
import Modal from './Modal';
import Tooltip from './Tooltip';
import ui from '../styles/ui.module.css';
import s from './WhatsNewDialog.module.css';

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
  const [unseen, setUnseen] = useState(() => unseenEntries(readSeen()));
  const [open, setOpen] = useState(() => unseen.length > 0);

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
        <button className={`${ui.iconBtn} ${s.trigger}`} aria-label={t('whats_new.trigger')} onClick={() => setOpen(true)}>
          <Sparkles size={18} strokeWidth={2} />
          {unseen.length > 0 && <span className={s.dot} />}
        </button>
      </Tooltip>

      <Modal open={open} onClose={close} title={t('whats_new.title')}>
        <p className={s.subtitle}>{t('whats_new.subtitle')}</p>

        {entries.map((entry) => (
          <div key={entry.id}>
            <h3 className={s.date}>
              {new Date(`${entry.id.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <ul className={s.list}>
              {(entry.items[locale] ?? entry.items.en).map((item) => (
                <li key={item} className={s.item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}

        <button className={ui.dialogClose} onClick={close}>{t('whats_new.close')}</button>
      </Modal>
    </>
  );
}
