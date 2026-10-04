/**
 * Productfoto's meten in de browser: afmeting, verhouding, bestandsgrootte,
 * scherpte en hoeveel witte rand er om het product zit.
 *
 * Scherpte: variantie van een Laplace-filter (de methode die ook OpenCV-
 * voorbeelden gebruiken). Een scherpe foto heeft veel harde overgangen en dus
 * een hoge variantie; een wazige foto een lage. We rekenen op een versie van
 * 600 px aan de lange kant, omdat de foto op de site ook ongeveer zo groot
 * staat, en alleen binnen het kader van het product: een grote witte rand
 * telt anders mee als "wazig".
 *
 * De drempels zijn een schatting en geen wet. Ze staan hier bovenaan zodat je ze
 * na een paar weken gebruik kunt bijstellen.
 */

export const DREMPELS = {
  /** Kortste zijde in pixels. Onder deze maat oogt de foto op een groot scherm korrelig. */
  minKorteZijde: 800,
  /** Breedte gedeeld door hoogte mag hier hooguit van 1 afwijken. */
  vierkantMarge: 0.05,
  /** Laplace-variantie op 600 px. Lager is mogelijk wazig. Proef op eigen foto's: scherp 70-1100, 2 px vervaagd 10-40. Effen donkere stof scoort van nature laag. */
  minScherpte: 40,
  /** Het product moet minstens dit deel van de langste zijde vullen (Amazon hanteert 85%). */
  minVulling: 0.75,
  /** Het midden van het product mag hooguit zoveel (deel van de breedte/hoogte) naast het midden liggen. */
  maxUitMidden: 0.08,
} as const;

export type FotoProbleem = 'te_klein' | 'niet_vierkant' | 'wazig' | 'witruimte' | 'uit_midden' | 'laadfout';

export const PROBLEEM_LABEL: Record<FotoProbleem, string> = {
  te_klein: 'Te klein',
  niet_vierkant: 'Niet vierkant',
  wazig: 'Mogelijk wazig',
  witruimte: 'Veel witruimte',
  uit_midden: 'Niet gecentreerd',
  laadfout: 'Laadt niet',
};

export type FotoMeting = {
  breedte: number | null;
  hoogte: number | null;
  bytes: number | null;
  /** Null als de pixels niet te lezen zijn (externe site zonder toestemming en de omweg faalde ook). */
  scherpte: number | null;
  /** Deel van het beeld (0-1) dat buiten het kader van het product valt. */
  witruimte: number | null;
  /** Hoe ver het product uit het midden staat (0 = precies midden). */
  uitMidden: number | null;
  /** Deel van de langste zijde dat het product vult (0-1). */
  vulling: number | null;
  problemen: FotoProbleem[];
};

const LEEG: FotoMeting = { breedte: null, hoogte: null, bytes: null, scherpte: null, witruimte: null, uitMidden: null, vulling: null, problemen: ['laadfout'] };

/** Adres van de omweg via onze eigen server, voor sites die geen CORS-toestemming geven. */
export const proxyUrl = (url: string) => `/dashboard/producten/fotocontrole/beeld?url=${encodeURIComponent(url)}`;

/** Hosts die geen CORS-toestemming geven: daar meteen de omweg nemen in plaats van eerst te mislukken. */
const zonderCors = new Set<string>();

async function haalBlob(url: string): Promise<Blob | null> {
  const eigen = url.startsWith('/') || url.startsWith(window.location.origin) || url.startsWith('blob:') || url.startsWith('data:');
  let host = '';
  try {
    host = new URL(url, window.location.href).host;
  } catch {
    return null;
  }
  if (eigen || !zonderCors.has(host)) {
    try {
      const r = await fetch(url, { mode: eigen ? 'same-origin' : 'cors', credentials: 'omit' });
      if (r.ok) return await r.blob();
    } catch {
      // Geen CORS of geen netwerk: via de server proberen.
      if (!eigen) zonderCors.add(host);
    }
  }
  if (eigen) return null;
  try {
    const r = await fetch(proxyUrl(url), { credentials: 'same-origin' });
    if (r.ok) return await r.blob();
  } catch {
    // Ook de omweg faalt.
  }
  return null;
}

function laadBeeld(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('laden mislukt'));
    img.src = src;
  });
}

/** Meet een foto: een URL (ook een pad als /merken/...) of een gekozen bestand. */
export async function meetFoto(bron: string | File): Promise<FotoMeting> {
  let blob: Blob | null = null;
  if (typeof bron === 'string') {
    if (!bron.trim()) return LEEG;
    blob = await haalBlob(bron.trim());
  } else {
    blob = bron;
  }

  // Zonder bytes kunnen we de foto vaak nog wel laden voor de afmetingen.
  if (!blob) {
    if (typeof bron !== 'string') return LEEG;
    try {
      const img = await laadBeeld(bron);
      return beoordeel({ ...LEEG, breedte: img.naturalWidth, hoogte: img.naturalHeight, problemen: [] });
    } catch {
      return LEEG;
    }
  }

  const objUrl = URL.createObjectURL(blob);
  try {
    const img = await laadBeeld(objUrl);
    const breedte = img.naturalWidth;
    const hoogte = img.naturalHeight;
    const pixels = analyseer(img);
    return beoordeel({ breedte, hoogte, bytes: blob.size, ...pixels, problemen: [] });
  } catch {
    return { ...LEEG, bytes: blob.size };
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

function beoordeel(m: FotoMeting): FotoMeting {
  const p: FotoProbleem[] = [];
  if (m.breedte && m.hoogte) {
    if (Math.min(m.breedte, m.hoogte) < DREMPELS.minKorteZijde) p.push('te_klein');
    if (Math.abs(m.breedte / m.hoogte - 1) > DREMPELS.vierkantMarge) p.push('niet_vierkant');
  } else {
    p.push('laadfout');
  }
  if (m.scherpte != null && m.scherpte < DREMPELS.minScherpte) p.push('wazig');
  if (m.vulling != null && m.vulling < DREMPELS.minVulling) p.push('witruimte');
  if (m.uitMidden != null && m.uitMidden > DREMPELS.maxUitMidden) p.push('uit_midden');
  return { ...m, problemen: p };
}

/** Scherpte en kader op een verkleinde kopie. */
function analyseer(img: HTMLImageElement): Pick<FotoMeting, 'scherpte' | 'witruimte' | 'uitMidden' | 'vulling'> {
  const LANG = 600;
  const schaal = Math.min(1, LANG / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * schaal));
  const h = Math.max(1, Math.round(img.naturalHeight * schaal));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { scherpte: null, witruimte: null, uitMidden: null, vulling: null };
  // Wit eronder: een transparante PNG telt dan als witte achtergrond.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return { scherpte: null, witruimte: null, uitMidden: null, vulling: null };
  }

  // Grijswaarden en achtergrondmasker (bijna wit = achtergrond).
  const grijs = new Float32Array(w * h);
  const rijTel = new Uint32Array(h);
  const kolTel = new Uint32Array(w);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    grijs[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (!(r > 242 && g > 242 && b > 242)) {
      rijTel[Math.floor(p / w)]++;
      kolTel[p % w]++;
    }
  }

  // Kader van het product: rijen en kolommen met meer dan 0,5% niet-witte pixels.
  const rijDrempel = Math.max(1, Math.round(w * 0.005));
  const kolDrempel = Math.max(1, Math.round(h * 0.005));
  let boven = 0;
  while (boven < h && rijTel[boven] < rijDrempel) boven++;
  let onder = h - 1;
  while (onder > boven && rijTel[onder] < rijDrempel) onder--;
  let links = 0;
  while (links < w && kolTel[links] < kolDrempel) links++;
  let rechts = w - 1;
  while (rechts > links && kolTel[rechts] < kolDrempel) rechts--;

  const leeg = boven >= h || links >= w;
  const kx0 = leeg ? 0 : links;
  const ky0 = leeg ? 0 : boven;
  const kx1 = leeg ? w - 1 : rechts;
  const ky1 = leeg ? h - 1 : onder;
  const kb = kx1 - kx0 + 1;
  const kh = ky1 - ky0 + 1;

  // Laplace (4-buren) binnen het kader, met 1 px marge van de rand.
  let som = 0;
  let somKw = 0;
  let n = 0;
  for (let y = Math.max(1, ky0); y <= Math.min(h - 2, ky1); y++) {
    for (let x = Math.max(1, kx0); x <= Math.min(w - 2, kx1); x++) {
      const p = y * w + x;
      const l = grijs[p - w] + grijs[p + w] + grijs[p - 1] + grijs[p + 1] - 4 * grijs[p];
      som += l;
      somKw += l * l;
      n++;
    }
  }
  const scherpte = n > 0 ? somKw / n - (som / n) ** 2 : null;

  const witruimte = leeg ? 1 : 1 - (kb * kh) / (w * h);
  const vulling = leeg ? 0 : Math.max(kb / w, kh / h);
  const cx = (kx0 + kx1 + 1) / 2 / w;
  const cy = (ky0 + ky1 + 1) / 2 / h;
  const uitMidden = leeg ? null : Math.max(Math.abs(cx - 0.5), Math.abs(cy - 0.5));

  return {
    scherpte: scherpte == null ? null : Math.round(scherpte),
    witruimte: Math.round(witruimte * 100) / 100,
    vulling: Math.round(vulling * 100) / 100,
    uitMidden: uitMidden == null ? null : Math.round(uitMidden * 100) / 100,
  };
}

export const kb = (bytes: number | null) =>
  bytes == null ? '-' : bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1000)} kB`;

/** Eén regel tekst voor onder een uploadveld. */
export function samenvatting(m: FotoMeting): string {
  if (m.problemen.includes('laadfout') && !m.breedte) return 'Deze foto laadt niet. Klopt de URL?';
  const delen = [`${m.breedte} × ${m.hoogte} px`];
  if (m.bytes != null) delen.push(kb(m.bytes));
  if (m.scherpte != null) delen.push(`scherpte ${m.scherpte}`);
  return delen.join(', ');
}

/** Uitleg per probleem, in gewone woorden. */
export function probleemUitleg(p: FotoProbleem, m: FotoMeting): string {
  switch (p) {
    case 'te_klein':
      return `Kortste zijde is ${Math.min(m.breedte ?? 0, m.hoogte ?? 0)} px; minstens ${DREMPELS.minKorteZijde} px oogt scherp op een groot scherm.`;
    case 'niet_vierkant':
      return 'Niet vierkant. In de lijst naast andere foto’s springt deze er dan uit.';
    case 'wazig':
      return 'Lijkt wazig. Kijk even op volle grootte of de stof en naden scherp zijn.';
    case 'witruimte':
      return `Het product vult maar ${Math.round((m.vulling ?? 0) * 100)}% van de foto. Snijd de witte rand bij.`;
    case 'uit_midden':
      return 'Het product staat niet in het midden.';
    case 'laadfout':
      return 'De foto laadt niet.';
  }
}
