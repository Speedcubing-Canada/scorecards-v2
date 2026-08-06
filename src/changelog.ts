import type { LocaleCode } from './types/settings';

/**
 * A batch of user-visible changes. `id` is the release date as `YYYY-MM-DD` so that
 * "newer than what you last saw" is a plain string comparison — no index lookup that
 * breaks when an old entry is dropped. A second entry on the same day gets a suffix
 * (`2026-08-06b`), which still sorts correctly.
 *
 * `en` is required; the other locales are optional and fall back to English.
 */
export interface ChangelogEntry {
  id: string;
  items: { en: string[] } & Partial<Record<LocaleCode, string[]>>;
}

/** Newest first. See the "What's new" section of the README before adding an entry. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-08-06',
    items: {
      en: [
        'Presets: start from the options a region usually prints, then change anything you want.',
      ],
      fr: [
        "Préréglages : partez des options habituelles d’une région, puis modifiez ce que vous voulez.",
      ],
      es: [
        'Preajustes: empiece con las opciones que suele usar una región y cambie lo que quiera.',
      ],
      pt: [
        'Predefinições: comece com as opções que uma região costuma imprimir e mude o que quiser.',
      ],
    },
  },
  {
    id: '2026-08-05',
    items: {
      en: [
        'The round checklist is now its own document, organised one table per day.',
        'Competitions with a single stage skip the stage picker and download the PDF directly.',
        'Stage names written in the room field of the schedule are now detected.',
      ],
      fr: [
        'La liste de vérification des rondes est maintenant un document distinct, avec un tableau par journée.',
        "Les compétitions à une seule scène sautent le choix de scène et téléchargent le PDF directement.",
        "Les noms de scène inscrits dans le champ « salle » de l'horaire sont maintenant détectés.",
      ],
      es: [
        'La lista de verificación de rondas es ahora un documento aparte, con una tabla por día.',
        'Las competencias con un solo escenario omiten el selector de escenario y descargan el PDF directamente.',
        'Ahora se detectan los nombres de escenario escritos en el campo de sala del horario.',
      ],
      pt: [
        'A lista de verificação das rondas é agora um documento separado, com uma tabela por dia.',
        'Competições com um único palco saltam o seletor de palco e transferem o PDF diretamente.',
        'Os nomes de palco escritos no campo de sala do horário são agora detetados.',
      ],
    },
  },
  {
    id: '2026-08-01',
    items: {
      en: [
        'New checking options: choose how scorecards are checked and what appears on the sheets.',
        'Improved French, Spanish and Portuguese wording throughout the app and the PDFs.',
      ],
      fr: [
        "Nouvelles options de vérification : choisissez comment les feuilles de pointage sont vérifiées et ce qui apparaît dessus.",
        "Formulations française, espagnole et portugaise améliorées dans l'application et les PDF.",
      ],
      es: [
        'Nuevas opciones de verificación: elija cómo se revisan las hojas y qué aparece en ellas.',
        'Mejores textos en francés, español y portugués en la aplicación y en los PDF.',
      ],
      pt: [
        'Novas opções de verificação: escolha como as folhas são verificadas e o que aparece nelas.',
        'Textos melhorados em francês, espanhol e português na aplicação e nos PDF.',
      ],
    },
  },
  {
    id: '2026-07-04',
    items: {
      en: [
        'Custom competitions: build scorecards for an event that is not on the WCA website.',
        'Scorecards can be generated for rounds without groups yet, using the advancement conditions.',
      ],
      fr: [
        "Compétitions personnalisées : créez des feuilles de pointage pour un événement absent du site de la WCA.",
        "Les feuilles peuvent être générées pour des rondes sans groupes, à partir des conditions d'avancement.",
      ],
      es: [
        'Competencias personalizadas: cree hojas para un evento que no está en el sitio de la WCA.',
        'Las hojas se pueden generar para rondas sin grupos, usando las condiciones de avance.',
      ],
      pt: [
        'Competições personalizadas: crie folhas para um evento que não está no site da WCA.',
        'As folhas podem ser geradas para rondas sem grupos, usando as condições de avanço.',
      ],
    },
  },
];

export const CHANGELOG_SEEN_KEY = 'changelog_seen';

const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * True once the newest entry is over a year old. When the tool matures and stops getting
 * regular feature work, the changelog stops being news — so it disappears entirely rather
 * than greeting organizers with last year's highlights.
 */
export function isStale(now: number = Date.now()): boolean {
  if (CHANGELOG.length === 0) return true;
  return now - Date.parse(CHANGELOG[0].id.slice(0, 10)) > MAX_AGE_MS;
}

/** Entries released after `seen`. A visitor with no marker sees everything. */
export function unseenEntries(seen: string | null, now: number = Date.now()): ChangelogEntry[] {
  if (isStale(now)) return [];
  return seen ? CHANGELOG.filter((e) => e.id > seen) : CHANGELOG;
}

export function readSeen(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Marks everything up to the newest entry as read. Silently ignores private-mode failures. */
export function markAllSeen(): void {
  try {
    localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG[0].id);
  } catch {
    // Storage unavailable (private mode) — the dialog just reappears next visit.
  }
}
