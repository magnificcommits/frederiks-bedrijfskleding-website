/**
 * Score voor het universele zoeken (CommandPalette, Cmd/Ctrl+K). Puur, zodat het
 * getest kan worden. Hoofdletters en accenten tellen niet ("categorieen" vindt
 * "categorieën"), en elk zoekwoord mag het begin van een woord zijn: "nieuw kl"
 * vindt "Nieuwe klant".
 */

export type ZoekItem = { label: string; sub?: string; woorden?: string };

/** Kleine letters, zonder accenten en zonder apostrofs. */
export function normZoek(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '');
}

/**
 * Score > 0 als elk zoekwoord in label, sub of zoekwoorden voorkomt; hoger = beter.
 * Begin van een woord in het label: 3, ergens in het label: 2, begin van een woord
 * in sub/zoekwoorden: 1. Begint het label met de hele zoekterm: +2.
 *
 * Zoekwoorden worden op dezelfde manier opgeknipt als de tekst: "e-mail" en "(2fa)"
 * vonden voorheen niets, omdat het streepje en de haakjes in het zoekwoord bleven staan.
 */
export function zoekScore(h: ZoekItem, term: string): number {
  const label = normZoek(h.label);
  const rest = normZoek(`${h.sub ?? ''} ${h.woorden ?? ''}`);
  const woorden = normZoek(term).split(/[^a-z0-9]+/).filter(Boolean);
  if (woorden.length === 0) return 0;
  const labelWoorden = label.split(/[^a-z0-9]+/);
  const restWoorden = rest.split(/[^a-z0-9]+/);
  let totaal = 0;
  for (const w of woorden) {
    if (labelWoorden.some((x) => x.startsWith(w))) totaal += 3;
    else if (label.includes(w)) totaal += 2;
    else if (restWoorden.some((x) => x.startsWith(w))) totaal += 1;
    else return 0;
  }
  if (label.startsWith(normZoek(term).trim())) totaal += 2;
  return totaal;
}
