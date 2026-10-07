/**
 * Foto's in bulk koppelen aan artikel en kleur, op basis van de bestandsnaam.
 * Werkt met de namen zoals leveranciers ze leveren, bijvoorbeeld FHB:
 *   Konrad_91490_1220_front.jpg  ->  artikel "Konrad", kleurcode 1220, voorkant
 * Pure functies: draaien in de browser (vooraf tonen) en in tests.
 */

export type KoppelArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  artNr: string | null;
  kleuren: { kleur: string; heeftFoto: boolean }[];
};

export type Zijde = 'voor' | 'achter' | 'overig';

export type Koppeling =
  | { status: 'gevonden'; artikel: KoppelArtikel; kleur: string; zijde: Zijde; vervangt: boolean }
  | { status: 'geen-kleur'; artikel: KoppelArtikel; zijde: Zijde }
  | { status: 'geen-artikel'; zijde: Zijde };

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Delen van de bestandsnaam, zonder extensie. "Konrad_91490_1220_front.jpg" -> [konrad, 91490, 1220, front]. */
export function naamDelen(bestand: string): string[] {
  const zonderExt = bestand.replace(/\.[a-z0-9]{2,5}$/i, '');
  return zonderExt.split(/[\s_.]+/).map(norm).filter(Boolean);
}

export function zijdeVan(delen: string[]): Zijde {
  if (delen.some((d) => /^(front|voor|voorkant|vorne|f)$/.test(d))) return 'voor';
  if (delen.some((d) => /^(back|achter|achterkant|ruck|rucken|b)$/.test(d))) return 'achter';
  if (delen.some((d) => /^(side|zij|detail|model|look)$/.test(d))) return 'overig';
  return 'voor';
}

/** De getallen in een kleurnaam: "Antraciet/Zwart 1220" -> ["1220"]. */
export function kleurCodes(kleur: string): string[] {
  return (kleur.match(/\d{2,5}/g) ?? []).map((c) => c.replace(/^0+(?=\d)/, ''));
}

/** De woorden van een kleurnaam: "Antraciet/Zwart 1220" -> ["antraciet", "zwart"]. */
function kleurWoorden(kleur: string): string[] {
  return norm(kleur)
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);
}

function artikelPast(a: KoppelArtikel, delen: string[]): number {
  const nr = a.artNr ? norm(a.artNr) : '';
  const nrKort = nr.replace(/^[a-z]+-/, '');
  // Artikelnummer exact als deel van de naam: sterkste match.
  if (nr && (delen.includes(nr) || delen.includes(nrKort))) return 3;
  // Artikelnummer met streepjes in de bestandsnaam ("Walter-Antraciet" zit al los).
  if (nr && delen.join('-').startsWith(nr + '-')) return 2;
  return 0;
}

/** Kiest per bestand het artikel en de kleur. */
export function koppelBestand(bestand: string, artikelen: KoppelArtikel[]): Koppeling {
  const delen = naamDelen(bestand);
  const zijde = zijdeVan(delen);
  let beste: KoppelArtikel | null = null;
  let score = 0;
  for (const a of artikelen) {
    const s = artikelPast(a, delen);
    if (s > score) {
      score = s;
      beste = a;
    }
  }
  if (!beste) return { status: 'geen-artikel', zijde };

  const getallen = new Set(delen.filter((d) => /^\d{2,5}$/.test(d)).map((d) => d.replace(/^0+(?=\d)/, '')));
  // Woorden uit de naam, ook samengestelde als "antraciet-zwart" opgesplitst.
  const woorden = new Set(delen.flatMap((d) => d.split('-')).filter((w) => /^[a-z]{2,}$/.test(w)));

  // 1. Kleurcode: het getal in de kleurnaam staat ook in de bestandsnaam.
  const opCode = beste.kleuren.filter((k) => kleurCodes(k.kleur).some((c) => getallen.has(c)));
  // 2. Anders: alle woorden van de kleurnaam staan in de bestandsnaam.
  const opNaam = opCode.length
    ? []
    : beste.kleuren.filter((k) => {
        const w = kleurWoorden(k.kleur);
        return w.length > 0 && w.every((x) => woorden.has(x));
      });
  const kandidaten = opCode.length ? opCode : opNaam;
  if (kandidaten.length !== 1) {
    // Bij meerdere kandidaten: de langste kleurnaam wint ("Antraciet/Zwart" boven "Zwart").
    const gesorteerd = [...kandidaten].sort((x, y) => kleurWoorden(y.kleur).length - kleurWoorden(x.kleur).length);
    if (gesorteerd.length > 1 && kleurWoorden(gesorteerd[0].kleur).length > kleurWoorden(gesorteerd[1].kleur).length) {
      const k = gesorteerd[0];
      return { status: 'gevonden', artikel: beste, kleur: k.kleur, zijde, vervangt: k.heeftFoto };
    }
    return { status: 'geen-kleur', artikel: beste, zijde };
  }
  const k = kandidaten[0];
  return { status: 'gevonden', artikel: beste, kleur: k.kleur, zijde, vervangt: k.heeftFoto };
}
