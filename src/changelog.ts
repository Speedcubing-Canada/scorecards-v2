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

/** Newest first. See "Contributing" in the README before adding an entry. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-09-09',
    items: {
      en: [
        'Scramble double-checking can now pick competitors by ranking: world top 50 by default, plus an optional national or continental threshold.',
        'Whole rounds are no longer double-checked by default, except finals at a championship.',
        'Scramble double-checking is now always on, with its settings under Advanced in the settings page.',
      ],
      fr: [
        'La revérification des mélanges peut maintenant cibler les compétiteurs par classement : top 50 mondial par défaut, avec un seuil national ou continental en option.',
        'Les tours entiers ne sont plus revérifiés par défaut, sauf les finales lors d\'un championnat.',
        'La revérification des mélanges est maintenant toujours active, avec ses réglages sous « Avancé » dans les paramètres.',
      ],
      es: [
        'La verificación doble de mezclas ya puede elegir competidores por ranking: top 50 mundial por defecto, más un umbral nacional o continental opcional.',
        'Las rondas completas ya no se verifican por defecto, salvo las finales en un campeonato.',
        'La verificación doble de mezclas ahora está siempre activa, con sus ajustes en "Avanzado" en la página de ajustes.',
      ],
      pt: [
        'A verificação dupla de embaralhamentos agora pode escolher competidores por ranking: top 50 mundial por padrão, mais um limite nacional ou continental opcional.',
        'Rodadas inteiras não passam mais por verificação dupla por padrão, exceto as finais em um campeonato.',
        'A verificação dupla de embaralhamentos agora está sempre ativa, com as configurações em "Avançado" na página de configurações.',
      ],
    },
  },
  {
    id: '2026-09-02',
    items: {
      en: [
        'The tool now sends an anonymous record of each generation: the competition id, its size, and the settings you picked. It helps us see where it is used and what to improve. Your name, your WCA account and competitor details are never sent, and your competition data is still never uploaded. "What is this?" has the details.',
        'You can now turn this off: open "What is this?" and tick the box under "Your data". The choice is remembered in this browser.',
      ],
      fr: [
        "L'outil envoie maintenant un enregistrement anonyme de chaque génération : l'identifiant de la compétition, sa taille et les réglages choisis. Cela nous aide à voir où il est utilisé et quoi améliorer. Votre nom, votre compte WCA et les informations des compétiteurs ne sont jamais envoyés, et les données de votre compétition ne sont toujours pas téléversées. Voir « Qu'est-ce que c'est ? » pour les détails.",
        "Vous pouvez maintenant le désactiver : ouvrez « Qu'est-ce que c'est ? » et cochez la case sous « Vos données ». Le choix est retenu dans ce navigateur.",
      ],
      es: [
        'La herramienta ahora envía un registro anónimo de cada generación: el identificador de la competencia, su tamaño y los ajustes que elegiste. Nos ayuda a ver dónde se usa y qué mejorar. Tu nombre, tu cuenta de la WCA y los datos de los competidores nunca se envían, y los datos de tu competencia siguen sin subirse. Consulta "¿Qué es esto?" para más detalles.',
        'Ahora puedes desactivarlo: abre "¿Qué es esto?" y marca la casilla bajo "Tus datos". La elección se recuerda en este navegador.',
      ],
      pt: [
        'A ferramenta agora envia um registro anônimo de cada geração: o identificador da competição, o seu tamanho e as configurações que escolheu. Ajuda-nos a ver onde ela é usada e o que melhorar. O seu nome, a sua conta da WCA e os dados dos competidores nunca são enviados, e os dados da sua competição continuam a não ser enviados. Veja "O que é isto?" para mais detalhes.',
        'Agora pode desativar isto: abra "O que é isto?" e marque a caixa em "Seus dados". A escolha fica guardada neste navegador.',
      ],
    },
  },
  {
    id: '2026-08-23',
    items: {
      en: [
        'FTO is now supported: it gets its own icon and name everywhere the other events do, ready for the day the WCA makes it official.',
      ],
      fr: [
        "L'Octaminx est maintenant pris en charge : il a son icône et son nom partout comme les autres épreuves, prêt pour le jour où la WCA le rendra officiel.",
      ],
      es: [
        'FTO ya es compatible: tiene su propio icono y nombre en todas partes, listo para el día en que la WCA lo haga oficial.',
      ],
      pt: [
        'O FTO já é suportado: tem o seu próprio ícone e nome em todo o lado, pronto para o dia em que a WCA o tornar oficial.',
      ],
    },
  },
  {
    id: '2026-08-06',
    items: {
      en: [
        'Presets: start from the options a region usually prints, then change anything you want.',
        'The download page now explains how to print and cut each PDF, including why the scorecards never need sorting.',
      ],
      fr: [
        "Préréglages : partez des options habituelles d’une région, puis modifiez ce que vous voulez.",
        "La page de téléchargement explique maintenant comment imprimer et découper chaque PDF, dont pourquoi les feuilles de pointage n'ont jamais besoin d'être triées.",
      ],
      es: [
        'Preajustes: empiece con las opciones que suele usar una región y cambie lo que quiera.',
        'La página de descarga ahora explica cómo imprimir y recortar cada PDF, incluido por qué las hojas de puntuación nunca hay que ordenarlas.',
      ],
      pt: [
        'Predefinições: comece com as opções que uma região costuma imprimir e mude o que quiser.',
        'A página de transferência agora explica como imprimir e recortar cada PDF, incluindo porque as folhas de pontuação nunca precisam de ser ordenadas.',
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

const CHANGELOG_SEEN_KEY = 'changelog_seen';

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
