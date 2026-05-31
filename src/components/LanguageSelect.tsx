import i18n, { LANGUAGES, type UILang } from '../i18n/index';

export default function LanguageSelect() {
  const currentLang = (i18n.language?.slice(0, 2) ?? 'en') as UILang;

  return (
    <select
      style={s.select}
      value={currentLang}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label="Language"
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}

const s: Record<string, React.CSSProperties> = {
  select: {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-muted)',
    borderRadius: 6,
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
