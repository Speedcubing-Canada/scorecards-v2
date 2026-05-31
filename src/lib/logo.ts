import type { CompetitionSettings } from '../types/settings';
import { SCC_DEFAULT_LOGO } from '../assets/scc-logo';

// 'custom'  — user uploaded a logo; show it alone (no comp name beside it)
// 'default' — bundled SCC logo; show comp name text + logo together
// 'none'    — no logo at all; show comp name text only
export type LogoState = 'custom' | 'default' | 'none';

export function logoState(settings: Pick<CompetitionSettings, 'logoDataUrl' | 'useDefaultLogo'>): LogoState {
  if (settings.logoDataUrl) return 'custom';
  if (settings.useDefaultLogo) return 'default';
  return 'none';
}

// Returns the data URL of the logo that will actually be rendered, or null if none.
export function resolveLogo(settings: Pick<CompetitionSettings, 'logoDataUrl' | 'useDefaultLogo'>): string | null {
  if (settings.logoDataUrl) return settings.logoDataUrl;
  if (settings.useDefaultLogo) return SCC_DEFAULT_LOGO;
  return null;
}
