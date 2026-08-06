/**
 * The download button label embeds the download filename - the bundle
 * (`<competitionId>_pdfs.zip`) or, when a single document was selected, that
 * PDF (`<competitionId>_first_timers.pdf`) - which is a single unbreakable
 * token. For competitions with a long ID the label would otherwise overflow the
 * fixed-width button - especially on phones - so the font shrinks in steps as
 * the label gets longer. (`overflowWrap` on the button is the final safety net
 * for pathologically long IDs.)
 *
 * Pure function of the *rendered* label length so it works across languages.
 */
export const DOWNLOAD_BUTTON_FONT_SIZE = 15;

export function downloadButtonFontSize(label: string): number {
  const len = label.length;
  if (len > 46) return 12;
  if (len > 38) return 13;
  if (len > 30) return 14;
  return DOWNLOAD_BUTTON_FONT_SIZE;
}
