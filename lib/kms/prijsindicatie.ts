/**
 * Prijsindicaties voor de publieke site. Puur rekenwerk, zonder database, zodat
 * het te testen is en ook in de browser (pakketsamensteller) kan draaien.
 *
 * Bron: de adviesprijs van de fabrikant (producten.verkoopprijs_basis) min de
 * korting die Frederiks zelf instelt in het KMS. Per kledingtype nemen we een
 * degelijk basisartikel: de 25%-grens van wat we voeren, niet het goedkoopste.
 * Logo's rekenen we met de eigen staffels uit decoratie_tarieven.
 */

export type Staffelregel = { techniek: string; formaat: string; vanaf_aantal: number; stukprijs: number };
export type Pakketregel = { type: string; per: number; positie: string };

export type PrijsData = {
  /** Adviesprijs per kledingtype (25%-grens), vóór korting. */
  typePrijzen: Record<string, number>;
  staffel: Staffelregel[];
  /** Korting op de adviesprijs in procenten (0-60). */
  korting: number;
  /** Teamgrootte waarmee de 'vanaf'-prijs wordt gerekend (bepaalt de logostaffel). */
  teamAantal: number;
};

/** Kledingtype uit een productnaam, zelfde indeling als de pakketsamensteller. */
export function typeVanNaam(naam: string): string | null {
  const n = naam.toLowerCase();
  if (/polo/.test(n) && !/sweat|trui|knit/.test(n)) return 'polo';
  if (/t-?shirt/.test(n)) return 'tshirt';
  if (/sweat|trui|hoodie|sweater/.test(n)) return 'sweater';
  if (/softshell/.test(n)) return 'softshell';
  if (/bodywarmer|gilet/.test(n)) return 'bodywarmer';
  if (/winterjas|parka|gevoerd/.test(n)) return 'winterjas';
  if (/broek/.test(n) && !/korte|short/.test(n)) return 'werkbroek';
  return null;
}

/** Waarde op een percentiel (0-1) van een lijst getallen. */
export function percentiel(waarden: number[], p: number): number | null {
  const s = waarden.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/** Logo op de rug is groot, de rest is een klein borstlogo. Beide geborduurd, en minimaal 70 cm² (onbelast). */
export function logoFormaat(positie: string): string {
  return positie === 'rug' ? 'L' : 'S';
}

/** Stukprijs voor een logo bij een aantal, uit de staffel. */
export function logoPrijs(staffel: Staffelregel[], techniek: string, formaat: string, aantal: number): number | null {
  const passend = staffel
    .filter((s) => s.techniek === techniek && s.formaat === formaat && s.vanaf_aantal <= Math.max(1, aantal))
    .sort((a, b) => b.vanaf_aantal - a.vanaf_aantal);
  return passend[0]?.stukprijs ?? null;
}

/** Prijs per medewerker voor een pakket, excl. btw. Null als een type geen prijs heeft. */
export function pakketPrijsPerMedewerker(regels: Pakketregel[], d: PrijsData): number | null {
  const factor = 1 - Math.min(60, Math.max(0, d.korting)) / 100;
  let totaal = 0;
  for (const r of regels) {
    const kleding = d.typePrijzen[r.type];
    if (!kleding) return null;
    const logo = logoPrijs(d.staffel, 'borduren', logoFormaat(r.positie), r.per * d.teamAantal) ?? 0;
    totaal += r.per * (kleding * factor + logo);
  }
  return totaal;
}

/** 'Vanaf ca.'-bedrag: naar boven afgerond op 5 euro, zodat het nooit lager is dan de berekening. */
export function afronden(v: number): number {
  return Math.ceil(v / 5) * 5;
}

/** Prijsklasse 1-3 binnen een groep: onderste, middelste of bovenste derde. */
export function prijsklasse(prijs: number, grenzen: [number, number]): 1 | 2 | 3 {
  if (prijs <= grenzen[0]) return 1;
  if (prijs <= grenzen[1]) return 2;
  return 3;
}

export function euro(v: number, decimalen = 0): string {
  return v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimalen, maximumFractionDigits: decimalen });
}
