import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tooltip from './Tooltip';

/** Where bug reports and feedback go. Imported, never re-typed - see contact-links.test.ts. */
export const REPO_URL = 'https://github.com/Speedcubing-Canada/scorecards-v2';
export const SUPPORT_EMAIL = 'software@speedcubingcanada.org';

/**
 * The GitHub mark and a mail icon, for the Header. Public organizers have no other way to
 * find us, so these sit next to the "what's new" sparkles on every signed-in page; the
 * signed-out login page gets the same two links as text inside AboutDialog.
 *
 * The mark is an <img> rather than a lucide icon because lucide 1.x dropped brand icons,
 * and design-system.test.ts forbids inline SVG in components - same escape hatch Logo uses.
 * ponytail: one grey mark for both themes; if it reads washed out, split it into
 * light/dark files and switch on useTheme() the way Logo.tsx does.
 */
export default function ContactLinks() {
  const { t } = useTranslation();

  return (
    <>
      <Tooltip label={t('contact.github')} placement="bottom">
        <a
          style={s.link}
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('contact.github')}
        >
          <img src="/github-mark.svg" alt="" width={18} height={18} />
        </a>
      </Tooltip>

      <Tooltip label={t('contact.email')} placement="bottom">
        <a style={s.link} href={`mailto:${SUPPORT_EMAIL}`} aria-label={t('contact.email')}>
          <Mail size={18} strokeWidth={2} />
        </a>
      </Tooltip>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  link: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0,
    borderRadius: '50%',
    color: 'var(--text-muted)', cursor: 'pointer',
  },
};
