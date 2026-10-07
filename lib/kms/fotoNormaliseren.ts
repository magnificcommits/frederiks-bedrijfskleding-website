/**
 * Productfoto's gelijk trekken: elk product vrijstaand op wit, bijgesneden en
 * even groot. Werkt op ruwe RGBA-pixels zodat het zonder netwerk te testen is;
 * sharp doet op de server alleen het in- en uitpakken en schalen.
 *
 * Drie soorten bronfoto's:
 * - transparant (WK, Tricorp): op wit leggen en bijsnijden op de vorm;
 * - lichte achtergrond (FHB, Brook): achtergrond optrekken naar zuiver wit en
 *   bijsnijden. Hier halen we bewust niets weg, anders verdwijnt wit textiel;
 * - grijze of gekleurde achtergrond (Snickers): ongewijzigd laten. Weghalen
 *   beschadigde donker textiel; zie stap 3.
 */

export type Methode = 'transparant' | 'licht' | 'vrijstaand' | 'ongewijzigd';

export type Resultaat = {
  /** Ondoorzichtige RGBA op wit, zelfde afmeting als de invoer. */
  pixels: Uint8ClampedArray;
  /** Uitsnede rond het product. */
  x: number;
  y: number;
  w: number;
  h: number;
  methode: Methode;
};

const LICHT = 225; // achtergrond telt als licht boven deze waarde per kanaal

function mediaan(waarden: number[]): number {
  const s = [...waarden].sort((a, b) => a - b);
  return s[s.length >> 1] ?? 0;
}

/** Mediaan van de randpixels per kanaal (r, g, b, a). */
export function randKleur(d: Uint8ClampedArray, W: number, H: number): [number, number, number, number] {
  const idx: number[] = [];
  const stapX = Math.max(1, Math.floor(W / 200));
  const stapY = Math.max(1, Math.floor(H / 200));
  for (let x = 0; x < W; x += stapX) idx.push(x * 4, ((H - 1) * W + x) * 4);
  for (let y = 0; y < H; y += stapY) idx.push(y * W * 4, (y * W + W - 1) * 4);
  return [0, 1, 2, 3].map((c) => mediaan(idx.map((k) => d[k + c]))) as [number, number, number, number];
}

function kader(W: number, H: number, isProduct: (k: number) => boolean) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isProduct(y * W + x)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Leg een pixel met dekking a (0-255) op wit. */
function opWit(d: Uint8ClampedArray, k: number, a: number) {
  const f = a / 255;
  d[k] = Math.round(d[k] * f + 255 * (1 - f));
  d[k + 1] = Math.round(d[k + 1] * f + 255 * (1 - f));
  d[k + 2] = Math.round(d[k + 2] * f + 255 * (1 - f));
  d[k + 3] = 255;
}

export function normaliseer(invoer: Uint8ClampedArray | Uint8Array, W: number, H: number): Resultaat {
  const d = new Uint8ClampedArray(invoer);
  const n = W * H;
  const [br, bg, bb, ba] = randKleur(d, W, H);
  const heel = { x: 0, y: 0, w: W, h: H };

  // 1. Al vrijstaand.
  if (ba < 20) {
    const alpha = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) alpha[i] = d[i * 4 + 3];
    for (let i = 0; i < n; i++) opWit(d, i * 4, alpha[i]);
    const k = kader(W, H, (i) => alpha[i] > 40);
    return { pixels: d, ...(k ?? heel), methode: k ? 'transparant' : 'ongewijzigd' };
  }

  // Eventuele halfdoorzichtige pixels eerst op wit leggen.
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] < 255) opWit(d, i * 4, d[i * 4 + 3]);

  // 2. Lichte achtergrond: optrekken naar wit, niets weghalen.
  if (br > LICHT && bg > LICHT && bb > LICHT) {
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      d[k] = Math.min(255, Math.round((d[k] * 255) / br));
      d[k + 1] = Math.min(255, Math.round((d[k + 1] * 255) / bg));
      d[k + 2] = Math.min(255, Math.round((d[k + 2] * 255) / bb));
    }
    const k = kader(W, H, (i) => d[i * 4] < 251 || d[i * 4 + 1] < 251 || d[i * 4 + 2] < 251);
    return { pixels: d, ...(k ?? heel), methode: k ? 'licht' : 'ongewijzigd' };
  }

  // 3. Grijze of gekleurde achtergrond: bewust NIET weghalen. Bij studiofoto's met
  // een donkere vignet (Snickers) liep het weghalen het zwarte of grijze textiel in
  // en beschadigde het product (7 okt 2026, 99 foto's teruggezet). Een hele foto met
  // eigen achtergrond is beter dan een kapotte. Vrijstaande versies vraag je op bij
  // de leverancier en zet je via het sleepvak erin.
  return { pixels: d, ...heel, methode: 'ongewijzigd' };
}

/** Marge rond het product in het vierkante eindbeeld (aandeel van de zijde). */
export const MARGE = 0.07;
export const ZIJDE = 1000;
