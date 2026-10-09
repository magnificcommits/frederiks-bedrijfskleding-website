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
  /** Hoofdkleur van het kledingstuk als #rrggbb (mediaan van de romp), voor de schets van de achterkant. */
  kleur?: string;
};

const MIN_RUN = 2;

/**
 * Voorgrond bepalen door de achtergrond vanaf de rand te laten "vollopen": een
 * pixel hoort bij de achtergrond als hij via kleine kleurstapjes met de rand
 * verbonden is. Zo werkt het ook bij foto's met een grijs verloop (studio-
 * vignet), waar een vaste achtergrondkleur het halve beeld als kledingstuk zag.
 * De rand van een kledingstuk is altijd een grotere stap, daar stopt het.
 * Bij een transparante foto telt gewoon de alfa.
 */
export function voorgrondMasker(data: Uint8ClampedArray, w: number, h: number, stap = 9): Uint8Array {
  const n = w * h;
  let transparantRand = 0;
  let randTotaal = 0;
  const randPixel = (p: number) => { randTotaal++; if (data[p * 4 + 3] < 20) transparantRand++; };
  for (let x = 0; x < w; x++) { randPixel(x); randPixel((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { randPixel(y * w); randPixel(y * w + w - 1); }
  const m = new Uint8Array(n);
  if (transparantRand > randTotaal / 2) {
    for (let p = 0; p < n; p++) if (data[p * 4 + 3] >= 40) m[p] = 1;
    return m;
  }
  // Alles begint als voorgrond; de achtergrond loopt vanaf de rand vol.
  m.fill(1);
  const rij = new Int32Array(n);
  let kop = 0;
  let staart = 0;
  const zaai = (p: number) => { if (m[p]) { m[p] = 0; rij[staart++] = p; } };
  for (let x = 0; x < w; x++) { zaai(x); zaai((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { zaai(y * w); zaai(y * w + w - 1); }
  const verschil = (a: number, b: number) =>
    Math.abs(data[a * 4] - data[b * 4]) + Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) + Math.abs(data[a * 4 + 2] - data[b * 4 + 2]);
  while (kop < staart) {
    const p = rij[kop++];
    const x = p % w;
    const buren = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
    for (const q of buren) {
      if (q < 0 || !m[q]) continue;
      if (data[q * 4 + 3] < 40 || verschil(p, q) <= stap) { m[q] = 0; rij[staart++] = q; }
    }
  }
  return m;
}

/**
 * Terugval voor wit op wit: alles wat duidelijk afwijkt van de randkleur. Een wit
 * shirt op een witte achtergrond heeft zachte randen waar het vollopen doorheen
 * lekt; de schaduwen en naden vangt deze methode wel.
 */
export function voorgrondGlobaal(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const rand: number[][] = [];
  const pak = (x: number, y: number) => { const i = (y * w + x) * 4; rand.push([data[i], data[i + 1], data[i + 2]]); };
  for (let x = 0; x < w; x++) { pak(x, 0); pak(x, h - 1); }
  for (let y = 0; y < h; y++) { pak(0, y); pak(w - 1, y); }
  const mediaan = (k: number) => { const s = rand.map((p) => p[k]).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const bg = [mediaan(0), mediaan(1), mediaan(2)];
  const m = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    if (data[i + 3] < 40) continue;
    if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 30) m[p] = 1;
  }
  return m;
}

/** Meten met het vollopen, en bij wit op wit (niets bruikbaars gevonden) met de terugval. */
export function meetFoto(data: Uint8ClampedArray, w: number, h: number, soort: Soort): FotoVorm {
  let masker = voorgrondMasker(data, w, h);
  let vorm = meetVorm(masker, w, h, soort);
  let deel = 0;
  for (let i = 0; i < masker.length; i++) deel += masker[i];
  deel /= masker.length;
  // Te weinig voorgrond betekent dat het vollopen door een zachte rand het
  // kledingstuk in is gelekt (wit op wit). Dan de terugval.
  if (!(soort === 'broek' ? vorm.pijpen : vorm.romp) || deel < 0.12) {
    masker = voorgrondGlobaal(data, w, h);
    vorm = meetVorm(masker, w, h, soort);
  }
  return { ...vorm, kleur: hoofdkleur(data, masker, w, h, vorm) };
}

/** Mediaan van de voorgrondpixels in het midden van het kledingstuk: de stofkleur, zonder zakken en randen. */
function hoofdkleur(data: Uint8ClampedArray, m: Uint8Array, w: number, h: number, v: FotoVorm): string | undefined {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const midden = (v.romp?.midden ?? 0.5) * w;
  const breed = Math.max(4, (v.romp?.breedte ?? 0.3) * w * 0.5);
  const boven = (v.romp?.schouder ?? 0.2) * h;
  const onder = (v.romp?.onder ?? 0.9) * h;
  for (let y = Math.round(boven + (onder - boven) * 0.3); y < onder - (onder - boven) * 0.2; y += 2) {
    for (let x = Math.round(midden - breed / 2); x < midden + breed / 2; x += 2) {
      const p = y * w + x;
      if (x < 0 || x >= w || !m[p]) continue;
      r.push(data[p * 4]); g.push(data[p * 4 + 1]); b.push(data[p * 4 + 2]);
    }
  }
  if (r.length < 10) return undefined;
  const hex = (v: number[]) => mediaanVan(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
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
