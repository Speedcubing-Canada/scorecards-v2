import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGES, type UILang } from '../i18n/index';
import s from './LanguageSelect.module.css';

export default function LanguageSelect() {
  const { t } = useTranslation();
  const currentLang = (i18n.language?.slice(0, 2) ?? 'en') as UILang;

  return (
    <select
      className={s.select}
      value={currentLang}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t('common.language')}
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
