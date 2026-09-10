import type { CompetitionSettings, CustomEvent } from '../types/settings';
import type { GenerationScope } from './generationScope';

/**
 * The handoff between the wizard's pages.
 *
 * /competitions (or /custom) → /scope → /settings → /generate each run as a separate route
 * with no shared React state, so what one step learns reaches the next through
 * sessionStorage. Everything that crosses a page boundary goes through this module.
 *
 * Reads never throw - a missing or malformed value yields the documented fallback, because a
 * half-written blob from an interrupted session must not be able to white-screen the wizard.
 *
 * Deliberately NOT here:
 *  - `oauth_state` / `pkce_verifier` (src/auth/AuthContext.tsx) - a different lifecycle,
 *    written and consumed inside one redirect round-trip.
 *  - `preset_settings` (src/presets/index.ts) - already encapsulated, with its own
 *    value-level validation this module would only wrap.
 */

const KEYS = {
  competitionId: 'selected_competition_id',
  competitionName: 'selected_competition_name',
  hasGroups: 'competition_has_groups',
  scope: 'generation_scope',
  detection: 'generation_detection',
  settings: 'competition_settings',
  isCustom: 'custom_competition',
  customEvents: 'custom_competition_events',
} as const;

/** The uploaded files whose name is shown back to the organizer, by storage key. */
const FILE_NAME_KEYS = {
  logo: 'logo_file_name',
  dcOverrides: 'dc_overrides_file_name',
} as const;

export type UploadKind = keyof typeof FILE_NAME_KEYS;

/** What the scope step detected about the WCIF, for the settings step to act on. */
export interface ScopeDetection {
  showSecondRoundMode: boolean;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ── Competition identity ──────────────────────────────────────────────────────

export function readCompetition(): { id: string; name: string } {
  return {
    id: sessionStorage.getItem(KEYS.competitionId) ?? '',
    name: sessionStorage.getItem(KEYS.competitionName) ?? '',
  };
}

export function writeCompetition(id: string, name: string): void {
  sessionStorage.setItem(KEYS.competitionId, id);
  sessionStorage.setItem(KEYS.competitionName, name);
}

// ── Group detection ───────────────────────────────────────────────────────────

/**
 * Whether the WCIF already has groups assigned, as seen by the scope step. The settings
 * step reads it to warn that scorecard counts will read 0, and must not re-fetch the WCIF
 * to find out. Unset (scope step bypassed) counts as "has groups", so the warning only
 * fires on a positive detection of their absence.
 */
export function readHasGroups(): boolean {
  return sessionStorage.getItem(KEYS.hasGroups) !== 'false';
}

export function writeHasGroups(hasGroups: boolean): void {
  sessionStorage.setItem(KEYS.hasGroups, String(hasGroups));
}

// ── Generation scope ──────────────────────────────────────────────────────────

export const DEFAULT_SCOPE: GenerationScope = {
  mode: 'everything',
  documents: {
    scorecards: true,
    scheduleTracker: true,
    nametags: true,
    roundChecklist: false,
    firstTimerSlips: false,
  },
};

export function readScope(): GenerationScope {
  return readStoredScope() ?? DEFAULT_SCOPE;
}

/**
 * The stored scope, or `null` when the scope step hasn't run. The scope step itself needs the
 * difference: `null` means "first visit, apply the defaults", a value means "the organizer came
 * back, restore what they picked".
 */
export function readStoredScope(): GenerationScope | null {
  const scope = readJson<GenerationScope | null>(KEYS.scope, null);
  // A blob without `documents` predates document selection: too old to restore from.
  return scope?.documents ? scope : null;
}

export function writeScope(scope: GenerationScope, detection: ScopeDetection): void {
  sessionStorage.setItem(KEYS.scope, JSON.stringify(scope));
  sessionStorage.setItem(KEYS.detection, JSON.stringify(detection));
}

/**
 * Round 2 prefilled-vs-blank only matters when an unassigned Round 2 will actually be
 * generated. Absent detection means the scope step was bypassed, so show the choice -
 * preserving the behaviour from before that step existed.
 */
export function readDetection(): ScopeDetection {
  const raw = readJson<Partial<ScopeDetection> | null>(KEYS.detection, null);
  return { showSecondRoundMode: raw?.showSecondRoundMode !== false };
}

// ── Custom (non-WCA) competitions ─────────────────────────────────────────────

export function readIsCustom(): boolean {
  return sessionStorage.getItem(KEYS.isCustom) === 'true';
}

export function readCustomEvents(): CustomEvent[] {
  return readJson<CustomEvent[]>(KEYS.customEvents, []);
}

export function writeCustom(events: CustomEvent[]): void {
  sessionStorage.setItem(KEYS.isCustom, 'true');
  sessionStorage.setItem(KEYS.customEvents, JSON.stringify(events));
}

/** Drop custom-competition state so it can never leak into a WCA flow. */
export function clearCustom(): void {
  sessionStorage.removeItem(KEYS.isCustom);
  sessionStorage.removeItem(KEYS.customEvents);
}

// ── Final settings ────────────────────────────────────────────────────────────

export function writeSettings(settings: CompetitionSettings): void {
  sessionStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

/**
 * The stored settings blob, or `null` when absent or unparseable - the generate page
 * redirects rather than guessing.
 *
 * Deliberately NOT typed as `CompetitionSettings`: the blob may have been written by an
 * older version of the app and be missing fields added since. `readSettings` migrates it
 * before it may be treated as one.
 */
export function readStoredSettings(): Record<string, unknown> | null {
  return readJson<Record<string, unknown> | null>(KEYS.settings, null);
}

/**
 * The stored settings as a usable `CompetitionSettings`, or `null` when there are none.
 *
 * Migrates the retired bilingual presets onto the primary + optional-secondary model, and
 * backfills every field added since a blob may have been written, so a session started on an
 * older build doesn't render `undefined`.
 */
export function readSettings(): CompetitionSettings | null {
  const s = readStoredSettings();
  if (!s) return null;
  if (s.language === 'bilingual-fr') { s.language = 'fr'; s.secondaryLanguage = 'en'; }
  else if (s.language === 'bilingual-en') { s.language = 'en'; s.secondaryLanguage = 'fr'; }
  else if (s.secondaryLanguage === undefined) { s.secondaryLanguage = null; }
  if (s.generationScope === undefined) s.generationScope = { mode: 'everything' };
  const gs = s.generationScope as Record<string, unknown>;
  if (gs.documents === undefined) gs.documents = {
    scorecards: true, scheduleTracker: true, nametags: true,
    roundChecklist: false, firstTimerSlips: false,
  };
  // Payloads saved with the earlier four-key `documents` object are missing this one.
  const gsDocs = gs.documents as Record<string, unknown>;
  if (gsDocs.roundChecklist === undefined) gsDocs.roundChecklist = false;
  if (s.hideWcaLiveId === undefined) s.hideWcaLiveId = false;
  // Blobs written before ILR existed were all WCA Live.
  if (s.liveResultsMode === undefined) s.liveResultsMode = 'wca-live';
  if (s.isCustomCompetition === undefined) s.isCustomCompetition = false;
  // Settings saved before the checking-mode option existed keep the original behaviour.
  if (s.scorecardCheckMode === undefined) s.scorecardCheckMode = 'per-group-card';
  // The retired 'checking-sheet' value meant "no cover cards, print the standalone sheet".
  // The sheet is now an independently-selected document, so only its cover-card half survives.
  if (s.scorecardCheckMode === 'checking-sheet') s.scorecardCheckMode = 'none';
  // Backfilled to the live defaults, not to "off": otherwise the same settings would mean
  // two different things depending on when the blob was written.
  if (s.scrambleDoubleCheckWorldTop === undefined) s.scrambleDoubleCheckWorldTop = 50;
  if (s.scrambleDoubleCheckRegionTop === undefined) s.scrambleDoubleCheckRegionTop = null;
  if (s.scrambleDoubleCheckRegionScope === undefined) s.scrambleDoubleCheckRegionScope = 'national';
  return s as unknown as CompetitionSettings;
}

// ── Uploaded file names ───────────────────────────────────────────────────────

/**
 * The name of an uploaded file. Purely a label beside its preview, so it has no place in
 * `CompetitionSettings` - but without it a restored upload shows as nameless.
 */
export function readFileName(kind: UploadKind): string | null {
  return sessionStorage.getItem(FILE_NAME_KEYS[kind]);
}

export function writeFileName(kind: UploadKind, name: string | null): void {
  if (name) sessionStorage.setItem(FILE_NAME_KEYS[kind], name);
  else sessionStorage.removeItem(FILE_NAME_KEYS[kind]);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

/**
 * Drop everything the steps after the competition picker produced. Called when a different
 * competition is picked, so the restore-on-back-navigation can't hand competition A's scope,
 * rounds and settings to competition B.
 */
export function clearDownstream(): void {
  for (const key of [KEYS.scope, KEYS.detection, KEYS.hasGroups]) sessionStorage.removeItem(key);
  clearSettings();
}

/**
 * Drop the submitted settings, so the settings step seeds itself from scratch. Used when the
 * scope step changes the regional preset: the new preset's seeds must not lose to what was
 * submitted under the old one.
 */
export function clearSettings(): void {
  sessionStorage.removeItem(KEYS.settings);
  for (const key of Object.values(FILE_NAME_KEYS)) sessionStorage.removeItem(key);
}

