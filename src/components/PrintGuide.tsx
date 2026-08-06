import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, CalendarDays, ClipboardCheck, IdCard, Scissors, UserPlus } from 'lucide-react';
import { guideSections, type GuideSection, type PdfJob } from '../lib/pdfJobs';
import { useIsMobile } from '../lib/useIsMobile';

const noteIcon: React.CSSProperties = { flexShrink: 0, marginTop: 2, color: 'var(--text-subtle)' };

type NoteSection = Exclude<GuideSection, 'scorecards'>;
const isNote = (x: GuideSection): x is NoteSection => x !== 'scorecards';

// The one-line sections: an icon and the string that explains what to do with that PDF.
// `satisfies` keeps the literal key types (so `t()` type-checks them) while still failing
// the build if a new GuideSection is added without a note here.
const NOTES = {
  schedule:       { icon: <CalendarDays size={16} strokeWidth={2} aria-hidden style={noteIcon} />,   key: 'generate.guide.schedule' },
  checking:       { icon: <ClipboardCheck size={16} strokeWidth={2} aria-hidden style={noteIcon} />, key: 'generate.guide.checking' },
  nametags:       { icon: <IdCard size={16} strokeWidth={2} aria-hidden style={noteIcon} />,         key: 'generate.guide.nametags' },
  'first-timers': { icon: <UserPlus size={16} strokeWidth={2} aria-hidden style={noteIcon} />,       key: 'generate.guide.first_timers' },
} as const satisfies Record<NoteSection, { icon: React.ReactNode; key: string }>;

/**
 * "How to print and cut" card under the download button. The scorecard half exists
 * because organisers have re-sorted a whole competition by hand after cutting: the deck
 * comes out of `reorderQuadrants` already ordered, and cutting it apart preserves that
 * order as long as the four quadrant piles are kept separate and stacked 1-2-3-4.
 */
export default function PrintGuide({ jobs }: { jobs: PdfJob[] }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const sections = guideSections(jobs);
  if (sections.length === 0) return null;

  return (
    <section style={s.card}>
      <h3 style={s.title}>
        <Scissors size={18} strokeWidth={2} aria-hidden />
        {t('generate.guide.title')}
      </h3>

      {sections.includes('scorecards') && (
        <>
          <p style={s.callout}>{t('generate.guide.scorecards.callout')}</p>
          <CutDiagram isMobile={isMobile} />
          <ol style={s.steps}>
            <li style={s.step}>{t('generate.guide.scorecards.steps.print')}</li>
            <li style={s.step}>{t('generate.guide.scorecards.steps.cut')}</li>
            <li style={s.step}>{t('generate.guide.scorecards.steps.stack')}</li>
            <li style={s.step}>{t('generate.guide.scorecards.steps.covers')}</li>
          </ol>
        </>
      )}

      <div style={sections.includes('scorecards') ? { ...s.notes, ...s.notesDivided } : s.notes}>
        {sections.filter(isNote).map(section => (
          <p key={section} style={s.note}>
            {NOTES[section].icon}
            <span>{t(NOTES[section].key)}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

/**
 * Sheet -> four piles -> one deck, drawn with plain divs: the design-system guard forbids
 * hand-rolled inline vector markup in the on-screen UI. Flows left-to-right, and
 * top-to-bottom on mobile.
 */
function CutDiagram({ isMobile }: { isMobile: boolean }) {
  const { t } = useTranslation();
  const Arrow = isMobile ? ArrowDown : ArrowRight;
  const arrow = <Arrow size={20} strokeWidth={2} aria-hidden style={{ color: 'var(--text-faint)', flexShrink: 0 }} />;

  return (
    <div style={{ ...s.diagram, ...(isMobile ? s.diagramMobile : {}) }}>
      <figure style={s.stage}>
        <div style={s.sheet}>
          {[1, 2, 3, 4].map(n => <div key={n} style={s.quad}>{n}</div>)}
        </div>
        <figcaption style={s.caption}>{t('generate.guide.scorecards.diagram.sheet')}</figcaption>
      </figure>

      {arrow}

      <figure style={s.stage}>
        <div style={s.piles}>
          {[1, 2, 3, 4].map(n => <div key={n} style={s.pile}>{n}</div>)}
        </div>
        <figcaption style={s.caption}>{t('generate.guide.scorecards.diagram.piles')}</figcaption>
      </figure>

      {arrow}

      <figure style={s.stage}>
        <div style={s.deck}>
          {[1, 2, 3, 4].map(n => <div key={n} style={s.deckLayer}>{n}</div>)}
        </div>
        <figcaption style={s.caption}>{t('generate.guide.scorecards.diagram.deck')}</figcaption>
      </figure>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', marginTop: 'var(--space-6)',
    textAlign: 'left',
  },
  title: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: '0 0 var(--space-4)',
    fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)',
  },
  callout: {
    backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 14px', margin: '0 0 var(--space-5)',
    fontSize: 'var(--fs-label)', fontWeight: 500, lineHeight: 1.6, color: 'var(--warning-text)',
  },

  diagram: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)',
    padding: 'var(--space-4) 0 var(--space-5)',
  },
  diagramMobile: { flexDirection: 'column', gap: 'var(--space-3)' },
  stage: { margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' },
  caption: { fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', textAlign: 'center' },

  // One sheet split into its four scorecard quadrants, numbered in print order.
  sheet: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, width: 72, height: 92,
    padding: 3, borderRadius: 'var(--radius-sm)',
    border: '1px dashed var(--border-strong)', backgroundColor: 'var(--surface-2)',
  },
  quad: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3, backgroundColor: 'var(--surface)', border: '1px solid var(--border-strong)',
    fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--primary)',
  },

  // The four cut piles, side by side and each already in order.
  piles: { display: 'flex', alignItems: 'flex-end', gap: 12, height: 92 },
  pile: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 42, borderRadius: 3,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border-strong)',
    // Two offset outlines behind each pile, so it reads as a stack of cut cards.
    boxShadow: '3px -3px 0 -1px var(--surface), 3px -3px 0 var(--border-strong),'
             + '6px -6px 0 -1px var(--surface), 6px -6px 0 var(--border-strong)',
    fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--primary)',
  },

  // The piles stacked into a single ordered deck.
  deck: {
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2,
    height: 92, width: 40,
  },
  deckLayer: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 16, borderRadius: 3,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border-strong)',
    fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--primary)',
  },

  steps: {
    margin: 0, paddingLeft: '1.3em', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
  },
  step: { fontSize: 'var(--fs-label)', lineHeight: 1.6, color: 'var(--text-muted)' },
  notes: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
  // Only when the scorecard steps are above it, to keep the two halves apart.
  notesDivided: {
    marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)',
  },
  note: {
    display: 'flex', gap: 'var(--space-2)', margin: 0,
    fontSize: 'var(--fs-label)', lineHeight: 1.6, color: 'var(--text-muted)',
  },
};
