import { useRef, useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CustomEvent, CustomEventFormat } from '../types/settings';
import { EVENT_ICONS } from '../assets/events';
import { parseCompetitorCsv } from '../lib/parseCompetitorCsv';
import Tooltip from './Tooltip';
import { useIsMobile } from '../lib/useIsMobile';

const WCA_EVENT_LABELS: Record<string, string> = {
  '222': '2×2', '333': '3×3', '444': '4×4', '555': '5×5',
  '666': '6×6', '777': '7×7', '333bf': '3BLD', '333fm': 'FMC',
  '333oh': 'OH', 'clock': 'Clock', 'minx': 'Mega', 'pyram': 'Pyra',
  'skewb': 'Skewb', 'sq1': 'SQ1', '444bf': '4BLD', '555bf': '5BLD',
  '333mbf': 'MBLD',
};

const FORMAT_OPTIONS: CustomEventFormat[] = ['avg5', 'mo3', 'bo3', 'bo2', 'bo1'];
// bo2/bo1 have no post-cutoff phase, so the cutoff input is hidden (and cleared).
const NO_CUTOFF_FORMATS: CustomEventFormat[] = ['bo2', 'bo1'];

/**
 * Editable list of custom events: name, icon, format, cutoff, time limit,
 * optional round label and optional competitor CSV. Used by the Settings page
 * (Advanced section) and by the custom-competition builder page.
 */
export default function CustomEventEditor({
  events,
  onChange,
}: {
  events: CustomEvent[];
  onChange: (events: CustomEvent[]) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const iconRefs = useRef<(HTMLInputElement | null)[]>([]);
  const csvRefs = useRef<(HTMLInputElement | null)[]>([]);
  // CSV file names are display-only; they don't belong in CompetitionSettings.
  const [csvNames, setCsvNames] = useState<Record<number, string>>({});

  function update(i: number, patch: Partial<CustomEvent>) {
    onChange(events.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function addEvent() {
    onChange([...events, { name: '', iconDataUrl: null, format: 'avg5', cutoff: '', limit: '' }]);
  }

  function removeEvent(i: number) {
    onChange(events.filter((_, idx) => idx !== i));
    iconRefs.current.splice(i, 1);
    csvRefs.current.splice(i, 1);
    setCsvNames(prev => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < i) next[idx] = v;
        else if (idx > i) next[idx - 1] = v;
      }
      return next;
    });
  }

  function setFormat(i: number, format: CustomEventFormat) {
    update(i, NO_CUTOFF_FORMATS.includes(format) ? { format, cutoff: '' } : { format });
  }

  function handleIconUpload(i: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update(i, { iconDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  function handleCsvUpload(i: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update(i, { competitors: parseCompetitorCsv(reader.result as string) });
      setCsvNames(prev => ({ ...prev, [i]: file.name }));
    };
    reader.readAsText(file);
  }

  function removeCsv(i: number) {
    update(i, { competitors: undefined });
    setCsvNames(prev => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
    const input = csvRefs.current[i];
    if (input) input.value = '';
  }

  return (
    <div>
      {events.map((custom, i) => (
        <div key={i} style={s.customEventCard}>
          <div style={s.customEventHeader}>
            <input
              type="text"
              placeholder={t('settings.advanced.event_name_placeholder')}
              value={custom.name}
              onChange={e => update(i, { name: e.target.value })}
              style={{ ...s.textInput, flex: 1 }}
            />
            <button style={s.removeBtn} onClick={() => removeEvent(i)}>{t('common.remove')}</button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: isMobile ? 8 : 16, alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{t('settings.advanced.format_label')}</span>
            {FORMAT_OPTIONS.map(fmt => (
              <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  checked={custom.format === fmt}
                  onChange={() => setFormat(i, fmt)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                {t(`settings.advanced.${fmt}`)}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
            {!NO_CUTOFF_FORMATS.includes(custom.format) && (
              <div style={{ flex: 1 }}>
                <div style={s.fieldLabel}>
                  {t('settings.advanced.cutoff_label')}{' '}
                  <span style={{ color: 'var(--text-faint)' }}>({t('settings.advanced.cutoff_optional')})</span>
                </div>
                <input
                  type="text"
                  placeholder="M:SS"
                  value={custom.cutoff}
                  onChange={e => update(i, { cutoff: e.target.value })}
                  style={{ ...s.textInput, padding: '7px 10px' }}
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={s.fieldLabel}>
                {t('settings.advanced.time_limit_label')}{' '}
                <span style={{ color: 'var(--text-faint)' }}>({t('settings.advanced.time_limit_optional')})</span>
              </div>
              <input
                type="text"
                placeholder="M:SS"
                value={custom.limit}
                onChange={e => update(i, { limit: e.target.value })}
                style={{ ...s.textInput, padding: '7px 10px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={s.fieldLabel}>
                {t('settings.advanced.round_label')}{' '}
                <span style={{ color: 'var(--text-faint)' }}>({t('settings.advanced.round_label_optional')})</span>
              </div>
              <input
                type="text"
                placeholder={t('settings.advanced.round_label_placeholder')}
                value={custom.roundLabel ?? ''}
                onChange={e => update(i, { roundLabel: e.target.value })}
                style={{ ...s.textInput, padding: '7px 10px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ ...s.fieldLabel, marginBottom: 6 }}>
              {t('settings.advanced.icon_hint')}
              {custom.iconDataUrl && (
                <button style={{ ...s.removeBtn, marginLeft: 10 }} onClick={() => update(i, { iconDataUrl: null })}>
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
                  onClick={() => update(i, { iconDataUrl: custom.iconDataUrl === dataUrl ? null : dataUrl })}
                  onKeyDown={e => e.key === 'Enter' && update(i, { iconDataUrl: custom.iconDataUrl === dataUrl ? null : dataUrl })}
                  style={{
                    ...s.iconBtn,
                    ...(custom.iconDataUrl === dataUrl ? s.iconBtnActive : {}),
                  }}
                >
                  <img src={dataUrl} alt={id} style={{ width: 20, height: 20 }} />
                  <span style={s.iconLabel}>{WCA_EVENT_LABELS[id] ?? id}</span>
                </div>
              ))}
              <Tooltip label={t('settings.advanced.icon_hint')}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t('common.upload')}
                  style={{
                    ...s.iconBtn,
                    ...(custom.iconDataUrl && !Object.values(EVENT_ICONS).includes(custom.iconDataUrl) ? s.iconBtnActive : {}),
                  }}
                  onClick={() => iconRefs.current[i]?.click()}
                  onKeyDown={e => e.key === 'Enter' && iconRefs.current[i]?.click()}
                >
                  <Upload size={18} strokeWidth={2} />
                  <span style={s.iconLabel}>{t('common.upload')}</span>
                </div>
              </Tooltip>
            </div>
            <input
              ref={el => { iconRefs.current[i] = el; }}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleIconUpload(i, e)}
            />
          </div>

          {custom.iconDataUrl && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={custom.iconDataUrl} alt="selected icon" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('settings.advanced.icon_selected')}</span>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={{ ...s.fieldLabel, marginBottom: 6 }}>
              {t('settings.advanced.csv_label')}{' '}
              <span style={{ color: 'var(--text-faint)' }}>({t('settings.advanced.csv_optional')})</span>
            </div>
            {custom.competitors && custom.competitors.length > 0 ? (
              <div style={s.csvPreview}>
                <span style={s.csvName}>{csvNames[i] ?? t('settings.advanced.csv_label')}</span>
                <span style={s.csvCount}>{t('settings.advanced.csv_count', { count: custom.competitors.length })}</span>
                <button style={s.removeBtn} onClick={() => removeCsv(i)}>{t('common.remove')}</button>
              </div>
            ) : (
              <>
                <p style={s.csvHint}>{t('settings.advanced.csv_hint')}</p>
                <button style={s.csvUploadBtn} onClick={() => csvRefs.current[i]?.click()}>
                  {t('common.choose_file')}
                </button>
              </>
            )}
            <input
              ref={el => { csvRefs.current[i] = el; }}
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ display: 'none' }}
              onChange={e => handleCsvUpload(i, e)}
            />
          </div>
        </div>
      ))}

      <button style={s.addCustomBtn} onClick={addEvent}>
        {t('settings.advanced.add_custom_event')}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  customEventCard: {
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 12,
  },
  customEventHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  fieldLabel: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 },
  textInput: {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: 'var(--surface)', color: 'var(--text)',
    border: '2px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: '10px 14px', fontSize: 'var(--fs-body)', fontFamily: 'inherit',
    outline: 'none',
  },
  removeBtn: {
    background: 'none', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
    padding: '3px 10px', fontSize: 'var(--fs-caption)', cursor: 'pointer', color: 'var(--text-muted)',
    fontFamily: 'inherit',
  },
  iconGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  iconBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 3, padding: '5px 6px',
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', backgroundColor: 'var(--surface)',
    minWidth: 38, userSelect: 'none', outline: 'none', color: 'var(--text-muted)',
  },
  iconBtnActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  iconLabel: { fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.1' },
  csvHint: { margin: '0 0 8px', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' },
  csvPreview: {
    display: 'flex', alignItems: 'center', gap: 12,
    backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '8px 12px',
  },
  csvName: { fontSize: 'var(--fs-label)', color: 'var(--text)', fontWeight: 500 },
  csvCount: { fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' },
  csvUploadBtn: {
    backgroundColor: 'var(--surface)', border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md)',
    padding: '8px 16px', fontSize: 'var(--fs-label)', cursor: 'pointer', color: 'var(--text-muted)',
    fontFamily: 'inherit',
  },
  addCustomBtn: {
    backgroundColor: 'var(--surface)', border: '2px dashed var(--border-strong)',
    borderRadius: 'var(--radius-md)', padding: '10px 20px', fontSize: 'var(--fs-body)',
    cursor: 'pointer', color: 'var(--text-muted)', width: '100%',
    marginTop: 4, fontFamily: 'inherit',
  },
};
