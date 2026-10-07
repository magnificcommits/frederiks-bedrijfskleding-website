/**
 * Productfoto's gelijk trekken: elk product vrijstaand op wit, bijgesneden en
 * even groot. Werkt op ruwe RGBA-pixels zodat het zonder netwerk te testen is;
 * sharp doet op de server alleen het in- en uitpakken en schalen.
 *
 * Drie soorten bronfoto's:
 * - transparant (WK, Tricorp): op wit leggen en bijsnijden op de vorm;
 * - lichte achtergrond (FHB, Brook): achtergrond optrekken naar zuiver wit en
 *   bijsnijden. Hier halen we bewust niets weg, anders verdwijnt wit textiel;
 * - grijze of gekleurde achtergrond (Snickers, Fristads): de achtergrond vanaf
 *   de randen laten 'weglopen' tot de omtrek van het kledingstuk en wit maken.
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

/** Maximaal kleurverschil tussen buurpixels binnen de achtergrond: eerst fijn, dan ruimer. */
const STAPPEN = [6, 12, 18];
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

  // 3. Grijze of gekleurde achtergrond: vanaf de randen laten weglopen. Lukt dat
  // niet met de fijne stap (sterk verloop of korrelige studiogloed), dan nog twee
  // keer met een ruimere stap. Pas daarna blijft de foto ongewijzigd.
  for (const stap of STAPPEN) {
    const achter = loopWeg(d, W, H, stap);
    let product = 0;
    for (let i = 0; i < n; i++) if (!achter[i]) product++;
    // Vangnet: blijft er bijna niets of bijna alles over, dan klopt het niet.
    if (product < n * 0.03 || product > n * 0.97) continue;
    for (let i = 0; i < n; i++) {
      if (achter[i]) {
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
        continue;
      }
      const x = i % W;
      const rand = (x > 0 && achter[i - 1]) || (x < W - 1 && achter[i + 1]) || (i >= W && achter[i - W]) || (i < n - W && achter[i + W]);
      if (rand) opWit(d, i * 4, 150); // zachte rand, geen kartels
    }
    const k = kader(W, H, (i) => !achter[i]);
    return { pixels: d, ...(k ?? heel), methode: 'vrijstaand' };
  }
  return { pixels: d, ...heel, methode: 'ongewijzigd' };
}

/** Markeer de achtergrond: alles wat vanaf de rand bereikbaar is met kleine kleurstappen. */
function loopWeg(d: Uint8ClampedArray, W: number, H: number, stap: number): Uint8Array {
  const n = W * H;
  const achter = new Uint8Array(n);
  const rij = new Int32Array(n);
  let kop = 0, staart = 0;
  const zet = (i: number) => {
    if (!achter[i]) {
      achter[i] = 1;
      rij[staart++] = i;
    }
  };
  for (let x = 0; x < W; x++) {
    zet(x);
    zet((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    zet(y * W);
    zet(y * W + W - 1);
  }
  const verschil = (a: number, b: number) =>
    Math.max(Math.abs(d[a * 4] - d[b * 4]), Math.abs(d[a * 4 + 1] - d[b * 4 + 1]), Math.abs(d[a * 4 + 2] - d[b * 4 + 2]));
  while (kop < staart) {
    const i = rij[kop++];
    const x = i % W;
    const buren = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < n - W ? i + W : -1];
    for (const b of buren) if (b >= 0 && !achter[b] && verschil(i, b) <= stap) {
      achter[b] = 1;
      rij[staart++] = b;
    }
  }
  return achter;
}

/** Marge rond het product in het vierkante eindbeeld (aandeel van de zijde). */
export const MARGE = 0.07;
export const ZIJDE = 1000;
