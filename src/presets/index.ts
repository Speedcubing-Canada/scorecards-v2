import type { CompetitionSettings } from '../types/settings';
import type { DocumentSelection } from '../lib/generationScope';

// A regional preset: a starting point for the options on /scope and /settings, so
// organizers in a region that always uses the same setup don't re-pick it every time.
// Adding one is a JSON file drop in this folder - no app code changes. See README.md.
//
// A preset only moves *defaults*; every option stays editable afterwards.
export interface Preset {
  id: string;
  // Plain display strings, deliberately not i18n keys: these are place names (which
  // don't translate), and a contributor dropping a JSON file can't add keys to the
  // four locale files.
  name: string;
  region?: string;
  documents: Partial<DocumentSelection>;
  settings: PresetSettings;
}

// The CompetitionSettings fields a preset is allowed to seed. Excludes anything
// competition-specific (ids, logos, custom events, generationScope).
export type PresetSettings = Partial<Pick<CompetitionSettings,
  | 'language' | 'secondaryLanguage' | 'paperFormat' | 'secondRoundMode'
  | 'useDefaultLogo' | 'hideWcaLiveId'
  | 'nametagLogoMode' | 'nametagQrMode' | 'nametagLayout'
  | 'scorecardCheckMode' | 'scrambleDoubleCheck'
>>;

const DOCUMENT_KEYS: (keyof DocumentSelection)[] = [
  'scorecards', 'scheduleTracker', 'nametags', 'roundChecklist', 'firstTimerSlips',
];

// Whitelist of seedable settings keys -> allowed values. `true` means "any boolean";
// an array means "one of these"; secondaryLanguage additionally accepts null.
const SETTING_VALUES: Record<keyof PresetSettings, readonly string[] | 'boolean'> = {
  language: ['en', 'fr', 'es', 'pt'],
  secondaryLanguage: ['en', 'fr', 'es', 'pt'],
  paperFormat: ['A4', 'LETTER'],
  secondRoundMode: ['prefilled', 'blanks'],
  useDefaultLogo: 'boolean',
  hideWcaLiveId: 'boolean',
  nametagLogoMode: ['hidden', 'with-name', 'logo-only'],
  nametagQrMode: ['back-only', 'both-sides'],
  nametagLayout: ['vertical', 'horizontal'],
  scorecardCheckMode: ['per-group-card', 'per-round-card', 'none'],
  scrambleDoubleCheck: 'boolean',
};

const SETTING_KEYS = Object.keys(SETTING_VALUES) as (keyof PresetSettings)[];

/**
 * Validate one preset payload. Whitelists keys and values so a contributor's typo
 * or a stale sessionStorage blob can never push an unknown value into
 * CompetitionSettings. Unknown/invalid entries are dropped; a preset without a
 * usable id and name is rejected outright (null).
 */
export function parsePreset(raw: unknown): Preset | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!id || !name) return null;

  return {
    id,
    name,
    ...(typeof o.region === 'string' && o.region.trim() ? { region: o.region.trim() } : {}),
    documents: parseDocuments(o.documents),
    settings: parsePresetSettings(o.settings),
  };
}

function parseDocuments(raw: unknown): Partial<DocumentSelection> {
  const out: Partial<DocumentSelection> = {};
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  for (const key of DOCUMENT_KEYS) {
    if (typeof o[key] === 'boolean') out[key] = o[key] as boolean;
  }
  return out;
}

/** Exported so SettingsPage can re-validate the blob it reads back from sessionStorage. */
export function parsePresetSettings(raw: unknown): PresetSettings {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    const value = o[key];
    const allowed = SETTING_VALUES[key];
    if (allowed === 'boolean') {
      if (typeof value === 'boolean') out[key] = value;
    } else if (key === 'secondaryLanguage' && value === null) {
      out[key] = null;
    } else if (typeof value === 'string' && allowed.includes(value)) {
      out[key] = value;
    }
  }
  return out as PresetSettings;
}

// Every JSON file in this folder is a preset. Build-time glob, so a new region is a
// file drop + PR - nothing here needs editing.
const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });

/** All shipped presets, sorted by name so file order doesn't drive the UI order. */
export const PRESETS: Preset[] = Object.values(modules)
  .map(parsePreset)
  .filter((p): p is Preset => p !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

const PRESET_SETTINGS_KEY = 'preset_settings';

/** Stash the settings half of a preset for the /settings step. `null` clears it. */
export function writePresetSettings(settings: PresetSettings | null): void {
  if (!settings) sessionStorage.removeItem(PRESET_SETTINGS_KEY);
  else sessionStorage.setItem(PRESET_SETTINGS_KEY, JSON.stringify(settings));
}

/** Read the stashed preset settings. Missing or corrupt ⇒ `{}` (plain defaults). */
export function readPresetSettings(): PresetSettings {
  try {
    const raw = sessionStorage.getItem(PRESET_SETTINGS_KEY);
    return raw ? parsePresetSettings(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function clearPresetSettings(): void {
  sessionStorage.removeItem(PRESET_SETTINGS_KEY);
}
