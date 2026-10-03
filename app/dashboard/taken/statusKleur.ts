/**
 * Kleurenpalet voor statussen en personen in de takenmodule, zoals de vaste
 * kleuren in Notion en Monday: Jessi kiest een naam uit een rijtje, geen hexcode.
 * In de database staat de sleutel ('geel', 'blauw', …).
 *
 * Puur en zonder serverimports: de client gebruikt de Tailwind-klassen, de
 * e-mail en de agenda-feed de hexwaarden. De klassen staan hier letterlijk,
 * zodat Tailwind ze vindt.
 */
export const KLEUREN = ['grijs', 'bruin', 'oranje', 'geel', 'groen', 'blauw', 'paars', 'roze', 'rood'] as const;
export type Kleur = (typeof KLEUREN)[number];

export const KLEUR_NAAM: Record<Kleur, string> = {
  grijs: 'Grijs',
  bruin: 'Bruin',
  oranje: 'Oranje',
  geel: 'Geel',
  groen: 'Groen',
  blauw: 'Blauw',
  paars: 'Paars',
  roze: 'Roze',
  rood: 'Rood',
};

/** pill = achtergrond + tekst, dot = bolletje, avatar = gevulde cirkel met witte/donkere letters. */
export const KLEUR_KLASSEN: Record<Kleur, { pill: string; dot: string; avatar: string }> = {
  grijs: { pill: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400', avatar: 'bg-ink-500 text-white' },
  bruin: { pill: 'bg-[#f1e6da] text-[#5b3d1f]', dot: 'bg-[#92633a]', avatar: 'bg-[#7c5530] text-white' },
  oranje: { pill: 'bg-orange-100 text-orange-900', dot: 'bg-orange-500', avatar: 'bg-orange-500 text-ink-900' },
  geel: { pill: 'bg-yellow-100 text-yellow-900', dot: 'bg-yellow-500', avatar: 'bg-yellow-400 text-ink-900' },
  groen: { pill: 'bg-green-100 text-green-900', dot: 'bg-green-600', avatar: 'bg-green-600 text-white' },
  blauw: { pill: 'bg-sky-100 text-sky-900', dot: 'bg-sky-500', avatar: 'bg-sky-600 text-white' },
  paars: { pill: 'bg-purple-100 text-purple-900', dot: 'bg-purple-500', avatar: 'bg-purple-600 text-white' },
  roze: { pill: 'bg-pink-100 text-pink-900', dot: 'bg-pink-500', avatar: 'bg-pink-600 text-white' },
  rood: { pill: 'bg-red-100 text-red-900', dot: 'bg-red-500', avatar: 'bg-red-600 text-white' },
};

/** Voor e-mail (inline styles): achtergrond en tekstkleur van de pill. */
export const KLEUR_HEX: Record<Kleur, { bg: string; tekst: string; vol: string }> = {
  grijs: { bg: '#e7e7e7', tekst: '#363636', vol: '#5f5f5f' },
  bruin: { bg: '#f1e6da', tekst: '#5b3d1f', vol: '#92633a' },
  oranje: { bg: '#ffedd5', tekst: '#7c2d12', vol: '#f97316' },
  geel: { bg: '#fef9c3', tekst: '#713f12', vol: '#eab308' },
  groen: { bg: '#dcfce7', tekst: '#14532d', vol: '#16a34a' },
  blauw: { bg: '#e0f2fe', tekst: '#0c4a6e', vol: '#0284c7' },
  paars: { bg: '#f3e8ff', tekst: '#581c87', vol: '#9333ea' },
  roze: { bg: '#fce7f3', tekst: '#831843', vol: '#db2777' },
  rood: { bg: '#fee2e2', tekst: '#7f1d1d', vol: '#dc2626' },
};

export function schoneKleur(v: unknown, standaard: Kleur = 'grijs'): Kleur {
  const s = String(v ?? '').trim();
  return (KLEUREN as readonly string[]).includes(s) ? (s as Kleur) : standaard;
}

export function kleurKlassen(v: unknown) {
  return KLEUR_KLASSEN[schoneKleur(v)];
}

/** Groepen zoals ClickUp/Notion: elke status valt in één groep. 'klaar' = taak is afgerond. */
export const STATUS_GROEPEN = ['open', 'bezig', 'wacht', 'klaar'] as const;
export type StatusGroep = (typeof STATUS_GROEPEN)[number];
export const GROEP_NAAM: Record<StatusGroep, string> = {
  open: 'Nog niet begonnen',
  bezig: 'Mee bezig',
  wacht: 'Wacht op iemand',
  klaar: 'Klaar (afgerond)',
};

/** Initialen voor de avatar: "Jessi" → "JE", "Tim de Jong" → "TJ". */
export function initialen(naam: string | null | undefined): string {
  const delen = String(naam ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (delen.length === 0) return '?';
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  const tussen = new Set(['de', 'van', 'der', 'den', 'het', 'ter', 'te', 'in', "'t"]);
  const laatste = [...delen].reverse().find((d, i) => i === 0 || !tussen.has(d.toLowerCase())) ?? delen[delen.length - 1];
  return (delen[0][0] + laatste[0]).toUpperCase();
}
