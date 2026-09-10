/**
 * The button label embeds the download filename, one unbreakable token, so a long competition
 * ID would overflow the fixed-width button on a phone. The font shrinks in steps as the label
 * grows; `overflowWrap` on the button catches the pathological cases.
 *
 * A pure function of the rendered length, so it works in every language.
 */
export const DOWNLOAD_BUTTON_FONT_SIZE = 15;

export function downloadButtonFontSize(label: string): number {
  const len = label.length;
  if (len > 46) return 12;
  if (len > 38) return 13;
  if (len > 30) return 14;
  return DOWNLOAD_BUTTON_FONT_SIZE;
}
