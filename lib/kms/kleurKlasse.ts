/**
 * Welke van de acht samenstellerkleuren is een leverancierskleur?
 *
 * Leveranciers schrijven kleuren op hun eigen manier: "9504 - Navy\Black",
 * "Marine/Zwart 1620", "BlackGrey", "Hi Viz Yellow / Navy". De eerste kleur is de
 * hoofdkleur; de rest is een accent (zakken, stiksels, schouderstukken). Een
 * marine broek met zwarte zakken hoort dus bij Marineblauw, niet bij Zwart.
 *
 * Volgorde van de regels telt: hi-vis en antraciet gaan voor de bredere
 * woorden geel, oranje en grijs.
 */

export type SamenstelKleur =
  | 'Zwart'
  | 'Marineblauw'
  | 'Antraciet'
  | 'Grijs'
  | 'Wit'
  | 'Groen'
  | 'Hi-vis geel'
  | 'Hi-vis oranje';

const REGELS: [SamenstelKleur, RegExp][] = [
  ['Hi-vis geel', /^(fluor(escent)?\s*(geel|yellow)|hi[\s-]?vi[sz]\s*(geel|yellow)|neon yellow|yellow|geel)/],
  ['Hi-vis oranje', /^(fluor(escent)?\s*(oranje|orange)|fluororange|hi[\s-]?vi[sz]\s*(oranje|orange)|warm orange|orange|oranje)/],
  ['Antraciet', /^(antraciet|anthracite|charcoal|dark\s*grey|darkgrey|donkergrijs|steel grey|convoy grey|oxford grey|slate grey|graphite)/],
  ['Marineblauw', /^(navy|marine|donker marineblauw|dark blue|deep blue|dark navy|indigo)/],
  ['Zwart', /^(black|zwart)/],
  ['Grijs', /^(grey|gray|grijs|greymel|ash grey|mid grey|lichtgrijs|light grey|ice grey|snow grey|silver)/],
  ['Wit', /^(white|wit)\b/],
  ['Groen', /^(forest green|bottle gr|kelly green|emerald green|khaki green|apple green|green|groen|olijf|olive)/],
];

/** Hoofdkleur uit een ruwe leverancierskleur, zonder code en zonder accentkleur. */
export function hoofdkleur(ruw: string): string {
  let k = ruw.trim().replace(/^\d{3,}\s*-\s*/, '').replace(/\s+\d{2,}\s*$/, '');
  // Aan elkaar geschreven combinaties: "BlackGrey", "WhiteDarkgrey".
  k = k.replace(/^([A-Z][a-z]+)(?=[A-Z][a-z])/, '$1 / ');
  return k.split(/\s*[\\/]\s*|\s+-\s+/)[0].trim().toLowerCase();
}

export function kleurKlasse(ruw: string | null | undefined): SamenstelKleur | null {
  if (!ruw) return null;
  const h = hoofdkleur(ruw);
  for (const [klasse, re] of REGELS) if (re.test(h)) return klasse;
  return null;
}
