/**
 * Huisstijlkleur van de prospect veilig en leesbaar maken.
 * Pure functies, geen portaal- of Supabase-imports (ook bruikbaar in clientcode).
 */

export const FREDERIKS_ORANJE = '#ec6726';

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normaliseer(kleur: string | null | undefined): string | null {
  const k = (kleur ?? '').trim();
  const m = HEX.exec(k);
  if (!m || !m[1]) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

function naarRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function naarHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function luminantie(hex: string): number {
  const [r, g, b] = naarRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminantie(a);
  const lb = luminantie(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mengMetZwart(hex: string, factor: number): string {
  const [r, g, b] = naarRgb(hex);
  return naarHex([r * (1 - factor), g * (1 - factor), b * (1 - factor)]);
}

export type Accent = {
  /** Vlakkleur (knoppen, balk). */
  accent: string;
  /** Tekstkleur op het accentvlak: wit of bijna-zwart, wat het beste contrast geeft. */
  opAccent: string;
  /** Accent als tekstkleur op wit, zo nodig donkerder gemaakt tot minimaal 4.5:1. */
  accentTekst: string;
  /** Zachte achtergrondtint van het accent. */
  accentZacht: string;
};

/**
 * Bepaalt een veilige accentkleur. Ongeldig of (bijna) wit valt terug op Frederiks-oranje.
 */
export function maakAccent(kleur: string | null | undefined): Accent {
  let accent = normaliseer(kleur) ?? FREDERIKS_ORANJE;
  // (Bijna) wit is onbruikbaar als vlak op een witte pagina. Geel en andere lichte kleuren
  // blijven gewoon staan: daar komt donkere tekst op en de tekstvariant wordt donkerder.
  if (contrast(accent, '#ffffff') < 1.12) accent = FREDERIKS_ORANJE;

  const donker = '#1c1c1c';
  const opAccent = contrast(accent, '#ffffff') >= contrast(accent, donker) ? '#ffffff' : donker;

  let accentTekst = accent;
  for (let i = 1; i <= 20 && contrast(accentTekst, '#ffffff') < 4.5; i++) {
    accentTekst = mengMetZwart(accent, i * 0.05);
  }

  const [r, g, b] = naarRgb(accent);
  const accentZacht = naarHex([r + (255 - r) * 0.9, g + (255 - g) * 0.9, b + (255 - b) * 0.9]);

  return { accent, opAccent, accentTekst, accentZacht };
}
