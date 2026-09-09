// Championship status is in neither the WCIF nor the WCA competition API, so the name is the
// only signal available. Deliberately a heuristic: it seeds a default the organizer can change,
// never a rule, so a miss in either direction costs one click.
const CHAMPIONSHIP = /championship|championnat|campeonato/i;

/** True when a competition's name reads as a championship, in any of the supported locales. */
export function isChampionship(name: string): boolean {
  return CHAMPIONSHIP.test(name);
}
