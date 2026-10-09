/**
 * Waar komt het logo op een echte productfoto?
 *
 * Leveranciersfoto's verschillen: het kledingstuk staat groter of kleiner in
 * beeld, met of zonder capuchon, recht of schuin gefotografeerd. Een vaste plek
 * in procenten van de foto (de eerste versie) zette het logo daardoor soms op de
 * mouw of naast het lichaam. Hier meten we het kledingstuk zelf op: waar de
 * schouders zitten, hoe breed de romp is en waar het midden ligt. Het logo komt
 * dan op de plek waar een borduurder het ook zet.
 *
 * Puur rekenwerk op pixels, zonder DOM, zodat het te testen is. De browser
 * levert de pixels via een canvas (zie components/FotoMetLogo.tsx).
 *
 * Conventie: "borst links" is links op het lichaam van de drager, dus rechts in
 * beeld op een vooraanzicht. Zelfde voor "pijp links".
 */

/** boven: met mouwen; mouwloos: bodywarmer; broek. */
export type Soort = 'boven' | 'mouwloos' | 'broek';

/** Plek van het logo, in fracties (0-1) van de breedte en hoogte van de foto. */
export type LogoPlek = { x: number; y: number; breedte: number };

export type FotoVorm = {
  breedte: number;
  hoogte: number;
  /** Romp: midden en breedte (fracties van de fotobreedte), schouderlijn en onderkant (fracties van de hoogte). */
  romp: { midden: number; breedte: number; schouder: number; onder: number } | null;
  /** Broekpijpen: midden en breedte per pijp, links en rechts in beeld. */
  pijpen: { links: { midden: number; breedte: number }; rechts: { midden: number; breedte: number }; hoogte: number } | null;
  /** 0-1: hoe gelijk de linker- en rechterhelft zijn. Onder de 0,8 is de foto schuin genomen. */
  symmetrie: number;
};

const MIN_RUN = 2;

/** Voorgrond: wat afwijkt van de achtergrondkleur (gemeten aan de rand), of niet-transparant is. */
export function voorgrondMasker(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const rand: number[][] = [];
  const pak = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rand.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
  };
  for (let x = 0; x < w; x++) { pak(x, 0); pak(x, h - 1); }
  for (let y = 0; y < h; y++) { pak(0, y); pak(w - 1, y); }
  const transparant = rand.filter((p) => p[3] < 20).length > rand.length / 2;
  const mediaan = (k: number) => {
    const s = rand.map((p) => p[k]).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const bg = [mediaan(0), mediaan(1), mediaan(2)];
  const m = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    if (data[i + 3] < 40) continue;
    if (transparant) { m[p] = 1; continue; }
    const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    if (d > 30) m[p] = 1;
  }
  return m;
}

type Run = { van: number; tot: number };

function runs(m: Uint8Array, w: number, y: number): Run[] {
  const uit: Run[] = [];
  let start = -1;
  let gat = 0;
  for (let x = 0; x <= w; x++) {
    const aan = x < w && m[y * w + x] === 1;
    if (aan) {
      if (start < 0) start = x;
      gat = 0;
    } else if (start >= 0) {
      gat++;
      // Kleine gaatjes (een naad, een reflectiestreep) horen bij hetzelfde stuk.
      if (gat > 2 || x === w) {
        const tot = x - gat;
        if (tot - start + 1 >= MIN_RUN) uit.push({ van: start, tot });
        start = -1;
        gat = 0;
      }
    }
  }
  return uit;
}

const mediaanVan = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function meetVorm(m: Uint8Array, w: number, h: number, soort: Soort): FotoVorm {
  const leeg: FotoVorm = { breedte: w, hoogte: h, romp: null, pijpen: null, symmetrie: 1 };
  const rijen: Run[][] = [];
  let boven = -1;
  let onder = -1;
  let links = w;
  let rechts = -1;
  for (let y = 0; y < h; y++) {
    const r = runs(m, w, y);
    rijen.push(r);
    if (r.length) {
      if (boven < 0) boven = y;
      onder = y;
      links = Math.min(links, r[0].van);
      rechts = Math.max(rechts, r[r.length - 1].tot);
    }
  }
  if (boven < 0 || onder - boven < h * 0.2) return leeg;
  const H = onder - boven;
  const breedteRij = (y: number) => {
    const r = rijen[y];
    return r.length ? r[r.length - 1].tot - r[0].van : 0;
  };
  const maxBreed = Math.max(...rijen.map((_, y) => breedteRij(y)));
  const bbMidden = (links + rechts) / 2;

  // Symmetrie: spiegel het masker in het midden van de omhullende en tel de overlap.
  let beide = 0;
  let een = 0;
  for (let y = boven; y <= onder; y += 2) {
    for (let x = links; x <= rechts; x += 2) {
      const xs = Math.round(2 * bbMidden - x);
      const a = m[y * w + x] === 1;
      const b = xs >= 0 && xs < w && m[y * w + xs] === 1;
      if (a && b) beide++;
      if (a || b) een++;
    }
  }
  const symmetrie = een ? beide / een : 1;

  if (soort === 'broek') {
    // Pijpen op een derde van de hoogte, onder het kruis. Lukt dat niet (pijpen
    // tegen elkaar aan), dan splitsen we de omhullende in het midden.
    const yPijp = Math.round(boven + H * 0.36);
    const r = [...(rijen[yPijp] ?? [])].sort((a, b) => b.tot - b.van - (a.tot - a.van)).slice(0, 2).sort((a, b) => a.van - b.van);
    let l: Run;
    let re: Run;
    if (r.length === 2 && r[1].tot - r[1].van > (r[0].tot - r[0].van) * 0.5) {
      [l, re] = r;
    } else {
      const rij = rijen[yPijp] ?? [];
      const a = rij[0]?.van ?? links;
      const b = rij[rij.length - 1]?.tot ?? rechts;
      const mid = (a + b) / 2;
      l = { van: a, tot: mid };
      re = { van: mid, tot: b };
    }
    return {
      ...leeg,
      symmetrie,
      pijpen: {
        links: { midden: (l.van + l.tot) / 2 / w, breedte: (l.tot - l.van) / w },
        rechts: { midden: (re.van + re.tot) / 2 / w, breedte: (re.tot - re.van) / w },
        hoogte: H / h,
      },
      romp: { midden: bbMidden / w, breedte: (rechts - links) / w, schouder: boven / h, onder: onder / h },
    };
  }

  // Rompbreedte: de smalste plek tussen oksel en zoom, gemeten op het stuk dat het
  // midden raakt. Bewust gemeten vanaf de onderkant, zodat een capuchon of hoge
  // kraag bovenaan de meting niet beïnvloedt.
  const breedtes: number[] = [];
  const middens: number[] = [];
  for (let y = Math.round(boven + H * 0.5); y <= Math.round(boven + H * 0.85); y++) {
    const r = rijen[y];
    if (!r?.length) continue;
    const raak = r.find((x) => x.van <= bbMidden && x.tot >= bbMidden) ?? r.reduce((a, b) => (b.tot - b.van > a.tot - a.van ? b : a));
    const b = raak.tot - raak.van;
    if (b < maxBreed * 0.25) continue;
    breedtes.push(b);
    middens.push((raak.van + raak.tot) / 2);
  }
  if (!breedtes.length) return { ...leeg, symmetrie };
  let romp = Math.min(...breedtes.filter((b) => b >= mediaanVan(breedtes) * 0.8));
  // Mouwen die langs het lichaam hangen, smelten in de foto samen met de romp.
  // Dan is de romp ongeveer 72% van de volle breedte.
  // Niet bij een bodywarmer: die is van boven tot onder ongeveer even breed.
  if (soort === 'boven' && romp > maxBreed * 0.86) romp = maxBreed * 0.72;

  // Schouderlijn: waar het silhouet in de bovenste 45% het sterkst breder wordt
  // en daarmee op rompbreedte komt.
  // Dat is de overgang van hals, kraag of capuchon naar de schouders. Een vaste
  // drempel op de breedte ging mis bij capuchons die bijna zo breed zijn als de romp.
  const k = Math.max(2, Math.round(H * 0.06));
  let schouder = boven;
  let besteStap = -1;
  for (let y = boven; y <= boven + H * 0.45; y++) {
    // Alleen overgangen die op volle rompbreedte uitkomen: de bovenkant van een
    // capuchon wordt ook snel breder, maar haalt die breedte niet.
    if (breedteRij(y + k) < romp * 0.9) continue;
    const stap = breedteRij(y + k) - breedteRij(y);
    if (stap > besteStap) { besteStap = stap; schouder = y + Math.round(k / 2); }
  }
  return {
    ...leeg,
    symmetrie,
    romp: { midden: mediaanVan(middens) / w, breedte: romp / w, schouder: schouder / h, onder: onder / h },
  };
}

/**
 * Logoplek voor een positie. Null als de positie niet op een vooraanzicht staat
 * (rug) of als de foto niet te meten was; dan toont de samensteller de tekening.
 */
export function logoPlek(v: FotoVorm, positie: string): LogoPlek | null {
  if (positie === 'rug') return null;
  if (positie.startsWith('dijbeen')) {
    if (!v.pijpen || !v.romp) return null;
    // Pijp links van de drager is rechts in beeld.
    const p = positie === 'dijbeen-links' ? v.pijpen.rechts : v.pijpen.links;
    const naarBuiten = positie === 'dijbeen-links' ? 1 : -1;
    return {
      x: p.midden + naarBuiten * p.breedte * 0.08,
      y: v.romp.schouder + v.pijpen.hoogte * 0.34,
      breedte: Math.min(p.breedte * 0.45, v.romp.breedte * 0.2),
    };
  }
  if (!v.romp) return null;
  const kant = positie === 'borst-rechts' ? -1 : 1;
  const L = v.romp.onder - v.romp.schouder;
  return {
    x: v.romp.midden + kant * v.romp.breedte * 0.2,
    y: v.romp.schouder + L * 0.2,
    breedte: v.romp.breedte * 0.17,
  };
}
