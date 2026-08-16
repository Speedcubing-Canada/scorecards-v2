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
  return readJson<GenerationScope>(KEYS.scope, DEFAULT_SCOPE);
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
 * older version of the app and be missing fields added since. `loadSettings` in
 * GeneratePage migrates it before it may be treated as one.
 */
export function readStoredSettings(): Record<string, unknown> | null {
  return readJson<Record<string, unknown> | null>(KEYS.settings, null);
}
