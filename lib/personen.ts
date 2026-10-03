/**
 * Gedeelde typen en hulpjes voor persoonsvelden ("aangevraagd door",
 * "leidinggevende", "door"). Bewust zonder server-imports: de PersoonKiezer in
 * de browser gebruikt dezelfde koppellogica als de server.
 *
 * Een persoonsveld verwijst altijd naar een vooraf aangemaakte persoon:
 * - contact:    rij in `contactpersonen` (mensen bij de klant met wie je zaken doet)
 * - medewerker: rij in `medewerkers` (de werknemers van de klant)
 * - intern:     rij in `taak_personen` (collega's van Frederiks)
 *
 * De naam gaat daarnaast als tekst mee, voor weergave en voor oude code die
 * alleen de tekstkolom leest.
 */

export type PersoonSoort = 'contact' | 'medewerker' | 'intern';

export type PersoonOptie = {
  id: string;
  soort: PersoonSoort;
  naam: string;
  email: string | null;
  /** Functie (contact), afdeling (werknemer) of iets anders dat helpt kiezen. */
  functie: string | null;
  hoofdcontact?: boolean;
};

export const SOORT_LABEL: Record<PersoonSoort, string> = {
  contact: 'Contactpersoon',
  medewerker: 'Werknemer',
  intern: 'Collega',
};

/** Kleine letters, zonder accenten en dubbele spaties: "Jansen , Ánne" ~ "jansen , anne". */
export function normaleNaam(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lijktOpEmail(s: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());
}

/**
 * Probeer een losse tekst (oude invoer, of een e-mailadres uit het portaal) aan
 * een bestaande persoon te koppelen. Alleen bij precies één treffer; bij twee
 * mensen met dezelfde naam gokken we niet.
 */
export function koppelOpNaam(tekst: string | null | undefined, opties: PersoonOptie[]): PersoonOptie | null {
  const t = normaleNaam(tekst);
  if (!t) return null;
  const treffers = lijktOpEmail(t)
    ? opties.filter((o) => normaleNaam(o.email) === t)
    : opties.filter((o) => normaleNaam(o.naam) === t);
  return treffers.length === 1 ? treffers[0] : null;
}

/** Zoeken terwijl je typt: alle woorden moeten voorkomen in naam, functie of e-mail. */
export function filterPersonen(opties: PersoonOptie[], zoek: string): PersoonOptie[] {
  const woorden = normaleNaam(zoek).split(' ').filter(Boolean);
  if (woorden.length === 0) return opties;
  const scoor = (o: PersoonOptie) => {
    const naam = normaleNaam(o.naam);
    const alles = `${naam} ${normaleNaam(o.functie)} ${normaleNaam(o.email)}`;
    if (!woorden.every((w) => alles.includes(w))) return -1;
    if (naam.startsWith(woorden.join(' '))) return 3;
    if (naam.split(' ').some((d) => d.startsWith(woorden[0]))) return 2;
    return 1;
  };
  return opties
    .map((o) => ({ o, s: scoor(o) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.o.naam.localeCompare(b.o.naam, 'nl'))
    .map((x) => x.o);
}
