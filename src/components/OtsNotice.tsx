import { useTranslation } from 'react-i18next';
import WarningBanner from './WarningBanner';

/** What an organizer fixes by hand when people register on the day. */
export default function OtsNotice() {
  const { t } = useTranslation();
  return (
    <WarningBanner tone="info">
      {t('warnings.ots_intro')}
      <ul>
        <li>{t('warnings.ots_blanks')}</li>
        <li>{t('warnings.ots_ids')}</li>
        <li>{t('warnings.ots_groups')}</li>
        <li>{t('warnings.ots_round2')}</li>
      </ul>
    </WarningBanner>
  );
}
