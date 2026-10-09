'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { afronden, euro, logoFormaat, logoPrijs, type PrijsData } from '@/lib/kms/prijsindicatie';
import { kleuren, kledingtypes, logoposities, broekposities, positiesVoor, teamgroottes, starterpakketten, teamAantal } from '@/content/configurator';
import { logoFormaten, oppervlakVan, logoCheck, standaardFormaatVoor, LOGO_MIN_CM2 } from '@/lib/fiscaal';
import { branches } from '@/content/branches';
import { Garment } from '@/components/Garments';
import { FotoMetLogo, isLicht, tekenFotoMetLogo, useFotoVorm } from '@/components/FotoMetLogo';
import { PakketExtra, extraRegels, type ExtraWaarde } from '@/components/PakketExtras';
import { AantalKiezer } from '@/components/AantalKiezer';
import { volledigeNaam } from '@/lib/offerteMand';
import { getHerkomst, leesHerkomstVoorLead } from '@/lib/herkomst';
import { site } from '@/content/site';

type Status = 'idle' | 'sending' | 'ok' | 'error';
type Item = { id: number; type: string; kleur: number; positie: string; aantal: string; artikelId?: string; artikelNaam?: string; artikelFoto?: string | null; voorbeeldFoto?: string | null; formaat?: string; per?: number };
type Artikel = { id: string; naam: string; merk: string | null; foto: string | null; kleur: string | null; kleurTreffer: boolean };

const extrasOpties = [
  { id: 'schoenen', label: 'Veiligheidsschoenen', type: 'schoenen' as const, uitleg: 'Kies een of meer modellen, of laat het aan Jessi. Zij adviseert de juiste veiligheidsklasse bij het passen.' },
  { id: 'accessoires', label: 'Accessoires (muts, handschoenen)', type: 'accessoires' as const, uitleg: 'Kies wat je erbij wilt hebben. Petten en mutsen kunnen ook met je logo.' },
]
const totaalStappen = 4;
const chip = 'min-h-[44px] cursor-pointer select-none rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition';
const swatch = 'h-9 w-9 rounded-full border-2 transition';
const field = 'invoer';

/** UTF-8-veilig base64 coderen en decoderen, zodat accenten en speciale tekens heel blijven. */
function encodeState(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeState(s: string): unknown {
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

/**
 * Voorbeeld van een kledingstuk met logo. Met een foto: het echte artikel met het
 * logo op de opgemeten plek (borst of pijp). Zonder foto, of voor een ruglogo
 * (de foto's zijn vooraanzichten): de tekening in de gekozen kleur.
 */
function Preview({ type, kleur, logo, positie, techniek, foto, toonSchuin }: { type: string; kleur: number; logo: string | null; positie: string; techniek: string; foto?: string | null; toonSchuin?: boolean }) {
  const k = kleuren[kleur];
  if (foto && positie !== 'rug') {
    return <FotoMetLogo src={foto} type={type} positie={positie} logo={logo} techniek={techniek} toonSchuin={toonSchuin} />;
  }
  if (foto && positie === 'rug') {
    return <RugVoorbeeld foto={foto} type={type} kleur={kleur} logo={logo} techniek={techniek} klein={!toonSchuin} />;
  }
  return (
    <div className="relative mx-auto aspect-square w-full">
      <Garment type={type} color={k.hex} light={k.licht} logo={logo} pos={positie} techniek={techniek} />
    </div>
  );
}

/**
 * Ruglogo bij een echt artikel. Leveranciers leveren alleen vooraanzichten; een
 * achteraanzicht verzinnen we niet. We tekenen de achterkant in de echte kleur
 * van het artikel (gemeten uit de foto) en laten de echte voorkant ernaast zien.
 */
function RugVoorbeeld({ foto, type, kleur, logo, techniek, klein }: { foto: string; type: string; kleur: number; logo: string | null; techniek: string; klein?: boolean }) {
  const vorm = useFotoVorm(foto, type);
  const hex = vorm?.kleur ?? kleuren[kleur].hex;
  return (
    <div className="relative mx-auto aspect-square w-full">
      <Garment type={type} color={hex} light={isLicht(hex)} logo={logo} pos="rug" techniek={techniek} />
      {!klein && (
        <div className="absolute bottom-1 right-1 w-[30%] rounded-md border border-line bg-white p-1 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/_next/image?url=${encodeURIComponent(foto)}&w=256&q=75`} alt="" className="aspect-square w-full object-contain" />
          <span className="block text-center text-[10px] font-semibold text-warm">voorkant</span>
        </div>
      )}
    </div>
  );
}

/** Logo-afmeting per kledingstuk, met direct of het onbelast mag (70 cm²-regel). */
function LogoRegel({ formaat, onChange }: { formaat?: string; onChange: (f: string) => void }) {
  const cm2 = oppervlakVan(formaat);
  const { onbelast, tekort } = logoCheck(cm2);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <select value={formaat ?? 'standaard'} onChange={(e) => onChange(e.target.value)} aria-label="Logo-afmeting"
        className="rounded-md border border-line bg-white px-2 py-1 text-xs text-ink-800">
        {logoFormaten.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${onbelast ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
        {onbelast ? `Onbelast · ${cm2} cm²` : `Nog ${tekort} cm² te klein`}
      </span>
    </div>
  );
}

export function PakketConfigurator({ defaultBranche = '', initialLogo = null, portaal, prijzen = null }: {
  defaultBranche?: string;
  /** Prijsindicatie uit het KMS; null als de schakelaar uit staat. Nooit in het portaal. */
  prijzen?: (PrijsData & { perBranche: Record<string, number> }) | null;
  initialLogo?: string | null;
  portaal?: { onAanvraag: (p: { regels: { item_naam: string; kleur: string | null; aantal: number }[]; notitie: string }) => Promise<{ ok: boolean; error?: string }>; bedrijfsnaam?: string };
}) {
  const [step, setStep] = useState(0);
  const [vanProduct, setVanProduct] = useState<string | null>(null);
  const toonPrijs = !portaal && prijzen;
  const [branche, setBranche] = useState(defaultBranche);
  const [team, setTeam] = useState('');
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [logoNaam, setLogoNaam] = useState<string | null>(null);
  const [techniek, setTechniek] = useState<'borduren' | 'bedrukken'>('borduren');
  const [defPositie, setDefPositie] = useState('borst-links');
  const [draft, setDraft] = useState<{ type: string; kleur: number; positie: string; aantal: string; artikelId?: string; artikelNaam?: string; artikelFoto?: string | null; artikelKleur?: number }>({ type: 'polo', kleur: 0, positie: 'borst-links', aantal: '' });
  const [artikelen, setArtikelen] = useState<Artikel[]>([]);
  const [artikelenBezig, setArtikelenBezig] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [starterGeladen, setStarterGeladen] = useState(false);
  const [witVoorbeeld, setWitVoorbeeld] = useState<string | null>(null);
  const [pdfBezig, setPdfBezig] = useState(false);
  /** Indicatie voor het hele pakket: adviesprijs min standaardkorting plus geborduurd logo per stuk. */
  const indicatie = (() => {
    if (!prijzen || !items.length) return null;
    const factor = 1 - prijzen.korting / 100;
    let som = 0;
    for (const i of items) {
      const n = parseInt(i.aantal || '0', 10) || 0;
      const kleding = prijzen.typePrijzen[i.type];
      if (!n || !kleding) return null;
      som += n * (kleding * factor + (logoPrijs(prijzen.staffel, 'borduren', logoFormaat(i.positie), n) ?? 0));
    }
    return afronden(som);
  })();
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, ExtraWaarde>>({});
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [bevestigd, setBevestigd] = useState(false);
  const [error, setError] = useState('');
  const [gedeeld, setGedeeld] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailEmail, setMailEmail] = useState('');
  const [mailConsent, setMailConsent] = useState(false);
  const [mailStatus, setMailStatus] = useState<Status>('idle');
  const [mailError, setMailError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Voorproefje van de homepage overnemen: kledingstuk, kleur en logo staan dan al klaar.
  useEffect(() => {
    try {
      const ruw = sessionStorage.getItem('fb-pakket-proef');
      if (!ruw) return;
      sessionStorage.removeItem('fb-pakket-proef');
      const p = JSON.parse(ruw) as { type?: string; kleur?: number; positie?: string; logo?: string | null; artikelId?: string; artikelNaam?: string; artikelFoto?: string | null };
      if (typeof p.type === 'string' && typeof p.kleur === 'number' && kleuren[p.kleur]) {
        const artikel = typeof p.artikelId === 'string' && typeof p.artikelNaam === 'string'
          ? { artikelId: p.artikelId, artikelNaam: p.artikelNaam, artikelFoto: typeof p.artikelFoto === 'string' ? p.artikelFoto : null, artikelKleur: p.kleur }
          : {};
        setDraft((d) => ({ ...d, type: p.type as string, kleur: p.kleur as number, positie: typeof p.positie === 'string' ? p.positie : d.positie, ...artikel }));
        if ('artikelId' in artikel) {
          // Vanaf een productpagina: eerst het logo uploaden (stap 1), het artikel staat al klaar.
          setVanProduct(artikel.artikelNaam ?? null);
          setStep(1);
        } else {
          // Voorproefje van de homepage: meteen naar de stap met de kleding.
          setStep(2);
        }
      }
      if (typeof p.logo === 'string' && p.logo.startsWith('data:image/')) setLogo(p.logo);
    } catch {
      // Geen of kapotte opslag: gewoon leeg beginnen.
    }
  }, []);

  // Echte artikelen uit het assortiment ophalen bij het gekozen type en de kleur.
  // Faalt dit (of staat de database uit), dan blijft de configurator gewoon werken
  // met de generieke kledingtypes — de suggestie is een plus, geen voorwaarde.
  useEffect(() => {
    let afgebroken = false;
    setArtikelenBezig(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ type: draft.type, kleur: kleuren[draft.kleur].name });
        const res = await fetch(`/api/pakket/artikelen?${q}`, { signal: ctrl.signal });
        const data = (await res.json()) as { artikelen: Artikel[] };
        if (afgebroken) return;
        const lijst = data.artikelen ?? [];
        setArtikelen(lijst);
        // Gekozen artikel bij een andere kleur: de foto in die kleur tonen. Heeft het
        // artikel die kleur niet, dan vervalt de keuze (anders zie je een zwarte jas
        // terwijl je marineblauw koos).
        setDraft((d) => {
          if (!d.artikelId) return d;
          const zelfde = lijst.find((a) => a.id === d.artikelId);
          if (zelfde) return { ...d, artikelFoto: zelfde.foto ?? d.artikelFoto, artikelKleur: d.kleur };
          if (d.artikelKleur !== d.kleur) return { ...d, artikelId: undefined, artikelNaam: undefined, artikelFoto: undefined, artikelKleur: undefined };
          return d;
        });
      } catch {
        if (!afgebroken) setArtikelen([]);
      } finally {
        if (!afgebroken) setArtikelenBezig(false);
      }
    }, 150);
    return () => { afgebroken = true; ctrl.abort(); clearTimeout(t); };
  }, [draft.type, draft.kleur]);

  // Logostap: een wit echt artikel als ondergrond, daar is elk logo goed op te zien.
  useEffect(() => {
    if (vanProduct) return;
    let weg = false;
    fetch(`/api/pakket/artikelen?${new URLSearchParams({ type: draft.type, kleur: 'Wit', n: '1' })}`)
      .then((r) => r.json() as Promise<{ artikelen?: Artikel[] }>)
      .then((d) => { if (!weg) setWitVoorbeeld(d.artikelen?.[0]?.foto ?? null); })
      .catch(() => { /* dan de schets */ });
    return () => { weg = true; };
  }, [draft.type, vanProduct]);

  const allePosities = [...logoposities, ...broekposities];
  /** Zolang er niets gekozen is, tonen we het eerste passende artikel als voorbeeld. */
  const voorbeeld = !draft.artikelId && !artikelenBezig ? artikelen[0] ?? null : null;
  const typeLabel = (id: string) => kledingtypes.find((t) => t.id === id)?.label ?? id;
  const posLabel = (id: string) => allePosities.find((p) => p.id === id)?.label ?? id;
  const starter = starterpakketten[branche];

  // Hydrateren uit een gedeelde link (?p=...). Kapotte param negeren we stil.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('p');
      if (!p) return;
      const data = decodeState(p) as Partial<{
        branche: string; team: string; techniek: 'borduren' | 'bedrukken';
        defPositie: string; items: Item[]; extras: Record<string, ExtraWaarde>;
      }>;
      if (typeof data.branche === 'string') setBranche(data.branche);
      if (typeof data.team === 'string') setTeam(data.team);
      if (data.techniek === 'borduren' || data.techniek === 'bedrukken') setTechniek(data.techniek);
      if (typeof data.defPositie === 'string') setDefPositie(data.defPositie);
      if (Array.isArray(data.items)) {
        setItems(data.items.map((i, n) => ({
          id: Date.now() + n,
          type: String(i.type),
          kleur: Number(i.kleur) || 0,
          positie: String(i.positie),
          aantal: String(i.aantal ?? ''),
          formaat: typeof i.formaat === 'string' ? i.formaat : standaardFormaatVoor(String(i.positie)),
        })));
      }
      if (data.extras && typeof data.extras === 'object') setExtras(data.extras);
    } catch {
      /* kapotte of verouderde link: gewoon leeg starten */
    }
  }, []);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { setError('Logo is te groot (max 2 MB).'); return; }
    setError('');
    setLogoNaam(f.name);
    const r = new FileReader();
    r.onload = () => setLogo(typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(f);
  }
  function chooseType(id: string) {
    setLastAdded(null);
    setDraft((d) => {
      const valid = positiesVoor(id).some((p) => p.id === d.positie);
      return { ...d, type: id, positie: valid ? d.positie : positiesVoor(id)[0].id, artikelId: undefined, artikelNaam: undefined, artikelFoto: undefined };
    });
  }
  function addItem() {
    const { artikelKleur: _k, ...stuk } = draft;
    setItems((p) => [...p, { id: Date.now(), ...stuk, voorbeeldFoto: draft.artikelFoto ? null : voorbeeld?.foto ?? null, formaat: standaardFormaatVoor(draft.positie) }]);
    setLastAdded(typeLabel(draft.type));
    setDraft((d) => ({ ...d, aantal: '', artikelId: undefined, artikelNaam: undefined, artikelFoto: undefined }));
  }
  function removeItem(id: number) { setItems((p) => p.filter((i) => i.id !== id)); }

  function vulMetStarter() {
    if (!starter) return;
    const basis = Date.now();
    const n = teamAantal(team);
    setItems(starter.map((s, k) => ({ id: basis + k, type: s.type, kleur: s.kleur, positie: s.positie, aantal: String(s.per * n), per: s.per, formaat: standaardFormaatVoor(s.positie) })));
    setStarterGeladen(true);
    setLastAdded(null);
    // Per stuk een echt artikel in die kleur als voorbeeldfoto erbij zoeken.
    starter.forEach(async (s, k) => {
      try {
        const q = new URLSearchParams({ type: s.type, kleur: kleuren[s.kleur].name });
        const data = (await (await fetch(`/api/pakket/artikelen?${q}`)).json()) as { artikelen: Artikel[] };
        const foto = data.artikelen?.[0]?.foto;
        if (foto) setItems((p) => p.map((i) => (i.id === basis + k ? { ...i, voorbeeldFoto: foto } : i)));
      } catch {
        /* dan blijft de tekening staan */
      }
    });
  }
  function zetFormaat(id: number, formaat: string) {
    setItems((p) => p.map((i) => (i.id === id ? { ...i, formaat } : i)));
  }
  const onbelastAantal = items.filter((i) => logoCheck(oppervlakVan(i.formaat)).onbelast).length;

  function buildResumeUrl(): string {
    const payload = { branche, team, techniek, defPositie, items, extras };
    return `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(encodeState(payload))}`;
  }

  function buildBericht(): string {
    const kledingLijst = items.length
      ? items.map((i) => `- ${typeLabel(i.type)}, ${kleuren[i.kleur].name}, logo ${posLabel(i.positie).toLowerCase()} (${oppervlakVan(i.formaat)} cm²)${i.aantal ? `, ${i.aantal}x` : ''}${i.artikelNaam ? `, voorkeur: ${i.artikelNaam}` : ''}`).join('\n')
      : '- (nog geen kledingstukken toegevoegd)';
    const extraLijst = extrasOpties.flatMap((e) => extraRegels(e.label, extras[e.id])).map((r) => `- ${r.naam} (${r.aantal}x)`).join('\n');
    return [
      'Pakket samengesteld via de configurator.',
      `Branche: ${branche || 'niet opgegeven'}`,
      `Teamgrootte: ${team || 'niet opgegeven'}`,
      `Logo: ${logo ? 'aangeleverd' : 'volgt later'}, techniek ${techniek}`,
      'Kledingstukken:', kledingLijst,
      ...(extraLijst ? ['Aanvullend:', extraLijst] : []),
    ].join('\n');
  }

  function svgNaarImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      try {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', '240');
        clone.setAttribute('height', '260');
        const xml = new XMLSerializer().serializeToString(clone);
        const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      } catch { resolve(null); }
    });
  }

  /** Plaatje per kledingstuk: de echte foto met logo, of de schets (rug, of geen foto). */
  async function maakStukBeelden(): Promise<(string | null)[]> {
    return Promise.all(items.map(async (i) => {
      const foto = i.artikelFoto ?? i.voorbeeldFoto;
      if (foto && i.positie !== 'rug') {
        const b = await tekenFotoMetLogo({ foto, type: i.type, positie: i.positie, logo });
        if (b) return b;
      }
      const svg = document.querySelector(`#ontwerp-schetsen [data-stuk="${i.id}"] svg`);
      const img = svg ? await svgNaarImage(svg as SVGSVGElement) : null;
      if (!img) return null;
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 640;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 640, 640);
      const s = Math.min(600 / img.width, 600 / img.height);
      ctx.drawImage(img, (640 - img.width * s) / 2, (640 - img.height * s) / 2, img.width * s, img.height * s);
      return c.toDataURL('image/png');
    }));
  }

  /** Elk beeld (ook SVG of WebP) als PNG, voor de PDF. */
  function naarPng(src: string, max = 600): Promise<string | null> {
    return new Promise((klaar) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((img.naturalWidth || max) * s));
        c.height = Math.max(1, Math.round((img.naturalHeight || max) * s));
        const ctx = c.getContext('2d');
        if (!ctx) return klaar(null);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        klaar(c.toDataURL('image/png'));
      };
      img.onerror = () => klaar(null);
      img.src = src;
    });
  }

  /** Rendert het ontwerp tot één gebrande PNG, voor in de e-mail. */
  async function genereerOntwerpPng(): Promise<string | null> {
    try {
      if (typeof document === 'undefined' || items.length === 0) return null;
      const beelden = await maakStukBeelden();
      const imgs = await Promise.all(beelden.map((b) => new Promise<HTMLImageElement | null>((klaar) => {
        if (!b) return klaar(null);
        const img = new Image();
        img.onload = () => klaar(img);
        img.onerror = () => klaar(null);
        img.src = b;
      })));
      const labels = items.map((i) => ({
        titel: `${typeLabel(i.type)}${i.aantal ? ` (${i.aantal}x)` : ''}`,
        sub: `${kleuren[i.kleur].name}, logo ${posLabel(i.positie).toLowerCase()}`,
      }));
      const cols = Math.min(3, items.length);
      const cell = 230, pad = 28, headerH = 96, labelH = 52;
      const rows = Math.ceil(items.length / cols);
      const W = pad * 2 + cols * cell;
      const H = headerH + pad + rows * (cell + labelH);
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(0, 0, W, headerH);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px Arial, sans-serif';
      ctx.fillText('FREDERIKS', pad, 46);
      ctx.fillStyle = '#ec6726';
      ctx.font = '700 12px Arial, sans-serif';
      ctx.fillText('B E D R I J F S K L E D I N G', pad, 66);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 15px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Jouw werkkledingontwerp', W - pad, 52);
      ctx.textAlign = 'left';
      imgs.forEach((img, idx) => {
        const r = Math.floor(idx / cols), c = idx % cols;
        const x = pad + c * cell, y = headerH + pad + r * (cell + labelH);
        if (img) ctx.drawImage(img, x + 8, y, cell - 16, cell - 16);
        const m = labels[idx];
        ctx.fillStyle = '#1c1c1c';
        ctx.font = '700 14px Arial, sans-serif';
        ctx.fillText(m.titel, x + 8, y + cell - 4);
        ctx.fillStyle = '#52504e';
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText(m.sub, x + 8, y + cell + 14);
      });
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return null;
    }
  }

  /** Het ontwerp als echte PDF downloaden: eigen opmaak, kaarten nooit afgebroken. */
  async function downloadPdf() {
    setPdfBezig(true);
    try {
      const [{ maakOntwerpPdf }, beelden, logoPng] = await Promise.all([
        import('@/lib/ontwerpPdf'),
        maakStukBeelden(),
        logo ? naarPng(logo) : Promise.resolve(null),
      ]);
      const formaatLabel = (id?: string) => logoFormaten.find((f) => f.id === (id ?? 'standaard'))?.label.toLowerCase() ?? '';
      const bytes = await maakOntwerpPdf({
        datum: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
        branche: branche || null,
        team: team ? `${team} medewerkers` : null,
        techniek: techniek === 'borduren' ? 'Borduren' : 'Bedrukken',
        logo: logoPng,
        stukken: items.map((i, n) => ({
          titel: `${typeLabel(i.type)}${i.aantal ? `, ${i.aantal} stuks` : ''}`,
          regels: [
            `Kleur: ${kleuren[i.kleur].name}`,
            `Logo: ${posLabel(i.positie).toLowerCase()}, ${formaatLabel(i.formaat)}`,
            i.artikelNaam ? `Artikel: ${i.artikelNaam}` : 'Artikel: Jessi stelt een passend model voor',
          ],
          beeld: beelden[n],
        })),
        aanvullend: extrasOpties.flatMap((e) => extraRegels(e.label, extras[e.id])).map((r) => `${r.naam}, ${r.aantal} stuks`),
        prijs: toonPrijs && indicatie !== null
          ? { bedrag: `ca. ${euro(indicatie)} excl. btw`, toelichting: 'Kleding met geborduurd logo, voor de aantallen hierboven. Eenmalig komen daar een borduurkaart en instelkosten bij. Je exacte prijs staat in de offerte.' }
          : null,
        contact: [contact.name, contact.company, contact.email, contact.phone].filter(Boolean).join(', ') || null,
        verderUrl: buildResumeUrl(),
        bedrijf: {
          naam: 'Frederiks Bedrijfskleding',
          adres: `${site.address.street}, ${site.address.city}`,
          telefoon: site.phone,
          email: site.email,
          web: site.url,
        },
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Werkkledingontwerp-Frederiks.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError('De PDF maken lukte niet. Probeer het nog eens, of mail je ontwerp naar jezelf.');
    } finally {
      setPdfBezig(false);
    }
  }

  function buildRegels(): { item_naam: string; kleur: string | null; aantal: number }[] {
    const kleding = items.map((i) => ({
      item_naam: `${i.artikelNaam ?? typeLabel(i.type)}, logo ${posLabel(i.positie).toLowerCase()} (${techniek})`,
      kleur: kleuren[i.kleur].name,
      aantal: Math.max(1, parseInt(i.aantal || '1', 10) || 1),
    }));
    const extra = extrasOpties.flatMap((e) => extraRegels(e.label, extras[e.id])).map((r) => ({
      item_naam: r.naam,
      kleur: null,
      aantal: r.aantal,
    }));
    return [...kleding, ...extra];
  }

  /** Zelfde pakket, maar gestructureerd voor het KMS: artikel-id, kleur, aantal en logo-opmerking. */
  function buildLeadRegels() {
    const kleding = items.map((i) => ({
      product_id: i.artikelId ?? null,
      omschrijving: i.artikelNaam ?? typeLabel(i.type),
      kleur: kleuren[i.kleur].name,
      aantal: Math.max(1, parseInt(i.aantal || '1', 10) || 1),
      opmerking: `logo ${posLabel(i.positie).toLowerCase()}, ${techniek}`,
    }));
    const extra = extrasOpties.flatMap((e) => extraRegels(e.label, extras[e.id])).map((r) => ({
      product_id: r.product_id,
      omschrijving: r.naam,
      kleur: null,
      aantal: r.aantal,
      opmerking: null,
    }));
    return [...kleding, ...extra];
  }

  async function submitPortaal() {
    if (!portaal) return;
    if (items.length === 0) { setError('Voeg eerst minstens één kledingstuk toe aan je pakket.'); return; }
    setStatus('sending'); setError('');
    try {
      const res = await portaal.onAanvraag({ regels: buildRegels(), notitie: buildBericht() });
      if (!res.ok) throw new Error(res.error ?? 'Er ging iets mis.');
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator-portaal' });
      setStatus('ok');
    } catch (e) { setStatus('error'); setError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  async function mailOntwerp() {
    if (!mailEmail || !mailConsent) { setMailError('Vul je e-mailadres in en geef toestemming.'); return; }
    setMailStatus('sending'); setMailError('');
    const ontwerp = await genereerOntwerpPng();
    try {
      const res = await fetch('/api/ontwerp-mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contact.name || '', email: mailEmail, bericht: buildBericht(), resumeUrl: buildResumeUrl(), ontwerp: ontwerp ?? '', bron: getHerkomst(), consent: true, logo: logo ?? '', logoNaam: logoNaam ?? '', herkomst: leesHerkomstVoorLead(), regels: buildLeadRegels() }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error ?? 'Er ging iets mis.'); }
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator-ontwerp-mail' });
      setMailStatus('ok');
    } catch (e) { setMailStatus('error'); setMailError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  async function kopieerLink() {
    const url = buildResumeUrl();
    try {
      await navigator.clipboard.writeText(url);
      setGedeeld(true);
      setTimeout(() => setGedeeld(false), 2500);
    } catch {
      setError('Kopiëren lukte niet. Kopieer de link handmatig uit de adresbalk.');
    }
  }

  async function submit() {
    if (!contact.name || !contact.email || !consent) { setError('Vul je naam en e-mailadres in en geef toestemming.'); return; }
    setStatus('sending'); setError('');
    const bericht = buildBericht();
    const ontwerp = await genereerOntwerpPng();
    try {
      const res = await fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, branche, aantal: team, bericht, bron: getHerkomst(), consent: true, logo: logo ?? '', logoNaam: logoNaam ?? '', ontwerp: ontwerp ?? '', bron_kanaal: 'configurator', herkomst: leesHerkomstVoorLead(), regels: buildLeadRegels() }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error ?? 'Er ging iets mis.'); }
      const j = (await res.json().catch(() => null)) as { bevestigd?: boolean } | null;
      setBevestigd(Boolean(j?.bevestigd));
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator' });
      setStatus('ok');
    } catch (e) { setStatus('error'); setError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  if (status === 'ok') {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border-2 border-amber-500 bg-white p-8 text-center shadow-card">
        {portaal ? (
          <>
            <p className="font-display text-2xl font-extrabold text-ink-900">Je ontwerp staat klaar.</p>
            <p className="mt-3 text-warm">We hebben je ontwerpaanvraag als concept ontvangen. Frederiks werkt het uit tot producten, maten en een offerte, en neemt contact op. Je ziet de aanvraag terug bij Mijn bestellingen.</p>
            <a href="/portaal/bestellingen" className="btn-primary mt-5 inline-block">Naar mijn bestellingen</a>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-extrabold text-ink-900">Bedankt, {contact.name.split(' ')[0]}.</p>
            <p className="mt-3 text-warm">We hebben je samengestelde pakket binnen. We bellen je binnen 24 uur terug om het door te nemen en maken een offerte op maat.{bevestigd ? ' Je krijgt ook een bevestiging per e-mail.' : ''}</p>
          </>
        )}
      </div>
    );
  }

  const next = () => setStep((s) => Math.min(totaalStappen - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const stapTitels = ['Voor wie', 'Je logo', 'Kleding', 'Aanvragen'];
  const kant = draft.type === 'werkbroek' ? 'Voorkant' : draft.positie === 'rug' ? 'Achterkant' : 'Voorkant';

  return (
    <div className="mx-auto max-w-6xl">

      {/* Voortgang: zelfde stappenbalk als het kledingadvies, met namen. Terug naar een eerdere stap kan door erop te klikken. */}
      <ol className="no-print grid grid-cols-4 overflow-hidden rounded-t-2xl bg-ink-900 print:hidden">
        {Array.from({ length: totaalStappen }).map((_, i) => {
          const stand = i < step ? 'klaar' : i === step ? 'nu' : 'straks';
          return (
            <li key={i} className={`relative ${i > 0 ? 'border-l border-white/10' : ''}`} aria-current={stand === 'nu' ? 'step' : undefined}>
              <button
                type="button"
                disabled={stand === 'straks'}
                onClick={() => setStep(i)}
                className="block w-full px-2 py-3 text-center disabled:cursor-default sm:px-4"
              >
                <span className={`block text-[11px] font-semibold ${stand === 'straks' ? 'text-ink-400' : 'text-amber-400'}`}>{stand === 'klaar' ? 'Klaar' : `Stap ${i + 1}`}</span>
                <span className={`block text-sm font-semibold ${stand === 'straks' ? 'text-ink-400' : 'text-white'}`}>{stapTitels[i]}</span>
              </button>
              <span className={`absolute inset-x-0 bottom-0 h-1 ${stand === 'straks' ? 'bg-transparent' : 'bg-amber-500'}`} aria-hidden="true" />
            </li>
          );
        })}
      </ol>

      <div className="rounded-b-2xl border border-t-0 border-line bg-white p-6 shadow-card sm:p-8 print:hidden">
        {step === 0 && (
          <div className="no-print">
            <h3 className="font-display text-2xl font-extrabold text-ink-900">Voor wie is de kleding?</h3>
            <p className="mt-1 text-sm text-warm">Zo stemmen we de modellen en het advies af op jouw werk.</p>
            <p className="mt-5 text-sm font-semibold text-ink-800">Branche</p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {branches.map((b) => (
                <button key={b.slug} type="button" onClick={() => setBranche(b.navLabel)}
                  className={`${chip} ${branche === b.navLabel ? 'border-amber-500 bg-amber-50 text-ink-900 shadow-soft' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'}`}>{b.navLabel}</button>
              ))}
              <button type="button" onClick={() => setBranche('Anders')} className={`${chip} ${branche === 'Anders' ? 'border-amber-500 bg-amber-50 text-ink-900 shadow-soft' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'}`}>Anders</button>
            </div>
            <p className="mt-6 text-sm font-semibold text-ink-800">Teamgrootte</p>
            <select className={`${field} max-w-xs`} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Kies een teamgrootte</option>
              {teamgroottes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {step === 1 && (
          <div className="no-print grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-2xl font-extrabold text-ink-900">Je logo en afwerking</h3>
              <p className="mt-1 text-sm text-warm">Upload je logo, dan zie je het zo op de kleding. Geen logo bij de hand? Sla over, je kunt het later aanleveren.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline px-4 py-2 text-[13px]">{logo ? 'Ander logo kiezen' : 'Upload je logo'}</button>
                {logo && <button type="button" onClick={() => { setLogo(null); setLogoNaam(null); }} className="text-sm text-warm hover:text-ink-800">Verwijderen</button>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogo} className="hidden" />
              </div>
              <p className="mt-2 text-xs text-warm">Tip: een logo met transparante achtergrond (PNG of SVG) staat het mooist op gekleurde kleding.</p>
              <p className="mt-5 text-sm font-semibold text-ink-800">Techniek</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {(['borduren', 'bedrukken'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTechniek(t)} className={`${chip} ${techniek === t ? 'border-amber-500 bg-amber-50 text-ink-900 shadow-soft' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'}`}>{t === 'borduren' ? 'Borduren' : 'Bedrukken'}</button>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold text-ink-800">Standaardpositie</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {logoposities.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setDefPositie(p.id); setDraft((d) => ({ ...d, positie: p.id })); }} className={`${chip} ${defPositie === p.id ? 'border-amber-500 bg-amber-50 text-ink-900 shadow-soft' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-mist p-6">
              <Preview type={draft.type} kleur={vanProduct ? draft.kleur : 4} logo={logo} positie={defPositie} techniek={techniek} foto={vanProduct ? draft.artikelFoto : witVoorbeeld} toonSchuin />
              {vanProduct ? (
                <p className="mt-3 text-center text-xs text-warm">Je ontwerpt met <span className="font-semibold text-ink-800">{vanProduct}</span>. Upload je logo; in de volgende stap voeg je dit artikel toe en kun je er meer kledingstukken bij zetten.</p>
              ) : (
                <p className="mt-3 text-center text-xs text-warm">Voorbeeld op een witte {typeLabel(draft.type).toLowerCase()}: daarop zie je je logo het best. In de volgende stap kies je de kleding en de kleuren.</p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="no-print grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-2xl font-extrabold text-ink-900">Stel je kleding samen</h3>
              <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-warm">
                <li><span className="text-amber-700">1.</span> Stel een stuk samen</li>
                <li><span className="text-amber-700">2.</span> Voeg het toe</li>
                <li><span className="text-amber-700">3.</span> Herhaal of ga verder</li>
              </ol>
              <div className="relative mt-4 rounded-xl border border-line bg-mist p-4 [&>div]:max-w-[17rem]">
                <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-600 shadow-sm">{kant}</span>
                <Preview type={draft.type} kleur={draft.kleur} logo={logo} positie={draft.positie} techniek={techniek} foto={draft.artikelFoto ?? voorbeeld?.foto} toonSchuin />
              </div>
              <p className="mt-2 min-h-[1.25rem] text-xs text-warm">
                {draft.artikelId && draft.artikelNaam
                  ? <>Gekozen: <span className="font-semibold text-ink-800">{draft.artikelNaam}</span></>
                  : voorbeeld
                    ? <>Voorbeeld: {volledigeNaam(voorbeeld.merk, voorbeeld.naam)}{voorbeeld.kleur ? `, ${voorbeeld.kleur.toLowerCase()}` : ''}. Kies hieronder je eigen model, of laat het aan ons.</>
                    : null}
                {draft.positie === 'rug' && (draft.artikelId || voorbeeld) ? ' Het ruglogo zie je op een schets van de achterkant.' : ''}
              </p>
              <p className="mt-5 text-sm font-semibold text-ink-800">Kledingstuk</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kledingtypes.map((t) => (
                  <button key={t.id} type="button" onClick={() => chooseType(t.id)} className={`${chip} ${draft.type === t.id ? 'border-amber-500 bg-amber-50 text-ink-900 shadow-soft' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'}`}>{t.label}</button>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-ink-800">Kleur: <span className="text-warm">{kleuren[draft.kleur].name}</span></p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {kleuren.map((k, i) => (
                  <button key={k.name} type="button" aria-label={k.name} onClick={() => setDraft((d) => ({ ...d, kleur: i }))} className={`${swatch} ${i === draft.kleur ? 'border-amber-500 ring-2 ring-amber-200' : 'border-line'}`} style={{ background: k.hex }} />
                ))}
              </div>
              {(artikelen.length > 0 || artikelenBezig) && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-ink-800">
                    Uit ons assortiment <span className="font-normal text-warm">(optioneel, je hoeft nu nog niets te kiezen)</span>
                  </p>
                  {artikelenBezig && artikelen.length === 0 ? (
                    <p className="mt-2 text-sm text-warm">Even zoeken…</p>
                  ) : (
                    <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1">
                      {artikelen.map((a) => {
                        const aan = draft.artikelId === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setDraft((d) => (aan ? { ...d, artikelId: undefined, artikelNaam: undefined, artikelFoto: undefined, artikelKleur: undefined } : { ...d, artikelId: a.id, artikelNaam: volledigeNaam(a.merk, a.naam), artikelFoto: a.foto, artikelKleur: d.kleur }))}
                            aria-pressed={aan}
                            className={`w-36 shrink-0 rounded-lg border-2 p-2 text-left transition ${aan ? 'border-amber-500 bg-amber-50' : 'border-line hover:border-ink-300'}`}
                          >
                            <span className="block h-20 w-full overflow-hidden rounded bg-mist">
                              {a.foto ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={a.foto} alt="" className="h-full w-full object-contain" loading="lazy" />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[11px] text-warm">geen foto</span>
                              )}
                            </span>
                            {a.merk && <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wide text-amber-700">{a.merk}</span>}
                            <span className="block text-xs font-semibold leading-tight text-ink-900">{a.naam}</span>
                            {a.kleur && <span className="mt-0.5 block text-[11px] text-warm">{a.kleur}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-warm">
                    Kies je niets, dan zoeken wij er een passend artikel bij. De prijs krijg je in je offerte, inclusief staffel en bedrukking.
                  </p>
                </div>
              )}
              {!artikelenBezig && artikelen.length === 0 && (
                <p className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-warm">
                  We hebben geen {typeLabel(draft.type).toLowerCase()} in {kleuren[draft.kleur].name.toLowerCase()} met een foto in de webcatalogus, daarom zie je een schets. Kies een andere kleur, of vraag het gewoon aan: we zoeken een passend model voor je.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink-800">Logo-positie</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {positiesVoor(draft.type).map((p) => (
                      <button key={p.id} type="button" onClick={() => setDraft((d) => ({ ...d, positie: p.id }))} className={`${chip} px-3 py-2 ${draft.positie === p.id ? 'border-amber-500 bg-amber-50 text-ink-900 shadow-soft' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'}`}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-800">Aantal</p>
                  <input type="number" min={0} value={draft.aantal} onChange={(e) => setDraft((d) => ({ ...d, aantal: e.target.value }))} placeholder="bijv. 10" className="mt-2 w-28 rounded-md border border-line px-3 py-2 text-sm" />
                </div>
              </div>
              {lastAdded && (
                <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{lastAdded} staat in je pakket. Kies hierboven een ander stuk en voeg het toe, of ga verder.</p>
              )}
              <button type="button" onClick={addItem} className="btn-primary mt-3 w-full justify-center text-base">+ Voeg toe aan je pakket</button>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Jouw pakket ({items.length})</p>
              {starter && items.length === 0 && (
                <div className="mt-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm">
                  <p className="font-bold text-ink-900">Geen idee waar je moet beginnen?</p>
                  <p className="mt-1 text-ink-800">
                    Dit leveren we bij {branche.toLowerCase()} het vaakst, per medewerker:
                  </p>
                  <ul className="mt-2 space-y-0.5 text-ink-800">
                    {starter.map((s, n) => (
                      <li key={n}>{s.per}x {typeLabel(s.type).toLowerCase()} in {kleuren[s.kleur].name.toLowerCase()}, logo {posLabel(s.positie).toLowerCase()}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-warm">
                    Met {teamAantal(team)} medewerkers{team ? ` (teamgrootte ${team})` : ' (pas de teamgrootte aan bij stap 1)'} rekenen we de aantallen voor je uit. Daarna pas je alles aan: aantallen, kleuren, stukken erbij of eraf.
                  </p>
                  {toonPrijs && prijzen.perBranche[branche] && (
                    <p className="mt-1 text-xs font-bold text-amber-900">Vanaf ca. {euro(prijzen.perBranche[branche])} per medewerker, met logo, excl. btw</p>
                  )}
                  <button type="button" onClick={vulMetStarter} className="btn-primary mt-3 w-full justify-center px-4 py-2 text-[13px]">Gebruik dit als startpunt</button>
                </div>
              )}
              {starterGeladen && items.length > 0 && (
                <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-xs text-ink-800">
                  Startvoorstel voor {branche.toLowerCase()}, {teamAantal(team)} medewerkers. Niets ligt vast: pas hieronder de aantallen aan of verwijder wat je niet nodig hebt. Jessi kijkt het samen met je na bij het passen.
                </p>
              )}
              {items.length === 0 && (
                <div className="mt-3 rounded-lg border border-line bg-mist p-4 text-sm text-warm">
                  Nog leeg. Stel links een kledingstuk samen en klik op <span className="font-semibold text-ink-700">Voeg toe aan je pakket</span>. Je kunt zoveel verschillende stukken toevoegen als je wilt.
                </div>
              )}
              <ul className="mt-3 space-y-3">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
                    <div className="h-14 w-14 shrink-0 rounded bg-mist p-1"><Preview type={i.type} kleur={i.kleur} logo={logo} positie={i.positie} techniek={techniek} foto={i.artikelFoto ?? i.voorbeeldFoto} /></div>
                    <div className="min-w-0 grow text-sm">
                      <p className="font-bold text-ink-900">{typeLabel(i.type)}</p>
                      <p className="text-warm">{kleuren[i.kleur].name}, logo {posLabel(i.positie).toLowerCase()}{i.per ? ` · ${i.per} per medewerker` : ''}</p>
                      {i.artikelNaam && <p className="truncate text-xs font-semibold text-amber-700">{i.artikelNaam}</p>}
                      <LogoRegel formaat={i.formaat} onChange={(f) => zetFormaat(i.id, f)} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="w-[7.5rem]">
                        <AantalKiezer klein label={`Aantal ${typeLabel(i.type).toLowerCase()}`} waarde={parseInt(i.aantal || '0', 10) || 0} onChange={(n) => setItems((p) => p.map((x) => (x.id === i.id ? { ...x, aantal: n ? String(n) : '', per: undefined } : x)))} />
                      </div>
                      <button type="button" onClick={() => removeItem(i.id)} className="text-xs text-warm hover:text-amber-800">Verwijder</button>
                    </div>
                  </li>
                ))}
              </ul>
              {items.length > 0 && (
                <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${onbelastAantal === items.length ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {onbelastAantal === items.length
                    ? `Alle ${items.length} kledingstukken hebben een logo van minimaal ${LOGO_MIN_CM2} cm². Dat mag je als werkgever onbelast geven.`
                    : `${items.length - onbelastAantal} van de ${items.length} kledingstukken ${items.length - onbelastAantal === 1 ? 'heeft' : 'hebben'} een logo onder ${LOGO_MIN_CM2} cm². ${items.length - onbelastAantal === 1 ? 'Dat telt' : 'Die tellen'} mee in je vrije ruimte. Kies een groter logo of laat het ons bekijken.`}{' '}
                  <Link href="/kennisbank/werkkostenregeling-werkkleding" className="font-semibold underline underline-offset-2">Hoe zit dat?</Link>
                </p>
              )}
              <p className="mt-6 text-sm font-semibold text-ink-800">Aanvullend nodig?</p>
              <p className="text-xs text-warm">Zonder logo, zoals veiligheidsschoenen.</p>
              <div className="mt-2 space-y-2">
                {extrasOpties.map((e) => (
                  <PakketExtra
                    key={e.id}
                    id={e.id}
                    label={e.label}
                    uitleg={e.uitleg}
                    type={e.type}
                    waarde={extras[e.id]}
                    standaardAantal={teamAantal(team)}
                    onChange={(w) => setExtras((p) => ({ ...p, [e.id]: w }))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div id="pakket-print" className="rounded-2xl bg-ink-900 p-6 text-white print:bg-white print:text-ink-900">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400 print:text-amber-700">Jouw pakket</p>
              <ul className="mt-4 space-y-1 text-sm text-ink-100 print:text-ink-800">
                <li><span className="text-ink-300 print:text-warm">Branche:</span> {branche || 'niet opgegeven'}</li>
                <li><span className="text-ink-300 print:text-warm">Team:</span> {team || 'niet opgegeven'}</li>
                <li><span className="text-ink-300 print:text-warm">Logo:</span> {logo ? `aangeleverd, ${techniek}` : 'volgt later'}</li>
              </ul>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-300 print:text-warm">Kledingstukken</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-100 print:text-ink-800">
                {items.length ? items.map((i) => <li key={i.id}>{typeLabel(i.type)}, {kleuren[i.kleur].name}, logo {posLabel(i.positie).toLowerCase()}{i.aantal ? `, ${i.aantal}x` : ''}</li>) : <li className="text-ink-400">Geen kledingstukken gekozen</li>}
                {extrasOpties.flatMap((e) => extraRegels(e.label, extras[e.id])).map((r) => <li key={r.naam}>{r.naam}, {r.aantal}x</li>)}
              </ul>
              {toonPrijs && indicatie !== null && (
                <div className="mt-4 rounded-lg bg-ink-800 px-4 py-3 print:bg-mist">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-400 print:text-amber-700">Prijsindicatie</p>
                  <p className="mt-1 text-lg font-extrabold text-white print:text-ink-900">ca. {euro(indicatie)} <span className="text-sm font-normal text-ink-300 print:text-warm">excl. btw</span></p>
                  <p className="mt-1 text-xs text-ink-300 print:text-warm">Kleding met geborduurd logo, voor de aantallen hierboven. Eenmalig komen daar een borduurkaart (€ 65 per logo) en instelkosten bij. Je exacte prijs staat in de offerte.</p>
                </div>
              )}
              <div className="mt-5 hidden border-t border-ink-700 pt-3 text-xs text-warm print:block">
                <p>Frederiks Bedrijfskleding. Samenvatting van je samengestelde pakket.</p>
                {(contact.name || contact.company || contact.email || contact.phone) && (
                  <p className="mt-1">Contact: {[contact.name, contact.company, contact.email, contact.phone].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
            {portaal ? (
            <div className="no-print rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h3 className="text-lg font-extrabold text-ink-900">Verstuur als ontwerpaanvraag</h3>
              <p className="mt-1 text-sm text-warm">Je ontwerp komt als concept binnen bij Frederiks{portaal.bedrijfsnaam ? ` voor ${portaal.bedrijfsnaam}` : ''}. We werken het uit tot producten, maten en een offerte, en nemen contact op.</p>
              {error && <p className="mt-3 text-sm font-medium text-amber-700" role="alert">{error}</p>}
              <button type="button" onClick={submitPortaal} disabled={status === 'sending'} className="btn-primary mt-4 w-full">{status === 'sending' ? 'Versturen' : 'Verstuur ontwerpaanvraag'}</button>
              <button type="button" onClick={downloadPdf} disabled={pdfBezig} className="btn-outline mt-3 w-full px-4 py-2 text-[13px]">{pdfBezig ? 'PDF maken…' : 'Download je ontwerp (PDF)'}</button>
            </div>
            ) : (
            <div className="no-print rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h3 className="text-lg font-extrabold text-ink-900">Vraag je pakket als offerte aan</h3>
              <p className="mt-1 text-sm text-warm">We bellen je binnen 24 uur terug en denken vrijblijvend mee.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className={field} placeholder="Naam *" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" />
                <input className={field} placeholder="Bedrijf" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} autoComplete="organization" />
                <input className={field} type="email" placeholder="E-mail *" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
                <input className={field} type="tel" placeholder="Telefoon" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" />
              </div>
              <label className="mt-3 flex items-start gap-3 text-sm text-warm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.
              </label>
              {error && <p className="mt-3 text-sm font-medium text-amber-700" role="alert">{error}</p>}
              <button type="button" onClick={submit} disabled={status === 'sending'} className="btn-primary mt-4 w-full">{status === 'sending' ? 'Versturen' : 'Verstuur mijn pakket'}</button>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <button type="button" onClick={kopieerLink} className="btn-outline px-4 py-2 text-[13px]">{gedeeld ? 'Gekopieerd' : 'Kopieer deelbare link'}</button>
                <button type="button" onClick={downloadPdf} disabled={pdfBezig} className="btn-outline px-4 py-2 text-[13px]">{pdfBezig ? 'PDF maken…' : 'Download je ontwerp (PDF)'}</button>
              </div>
              <p className="mt-2 text-xs text-warm">Bewaar je ontwerp als PDF of stuur de link naar een collega.</p>
            </div>
            )}
          </div>
        )}

        {error && step !== 3 && <p className="no-print mt-4 text-sm font-medium text-amber-700" role="alert">{error}</p>}

        {!portaal && step < totaalStappen - 1 && (
          <div className="no-print mt-8 rounded-xl border border-line bg-mist p-4">
            {mailStatus === 'ok' ? (
              <p className="text-sm font-medium text-ink-800">Gelukt. Je ontwerp staat in je mail, met een link om later verder te gaan.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-800">Nu geen tijd? Mail jezelf je ontwerp en ga later verder.</p>
                  {!mailOpen && <button type="button" onClick={() => setMailOpen(true)} className="btn-outline px-4 py-2 text-[13px]">Mail mij mijn ontwerp</button>}
                </div>
                {mailOpen && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      <input className={`${field} max-w-xs flex-1`} type="email" placeholder="Je e-mailadres" value={mailEmail} onChange={(e) => setMailEmail(e.target.value)} autoComplete="email" />
                      <button type="button" onClick={mailOntwerp} disabled={mailStatus === 'sending'} className="btn-primary px-4 py-2 text-[13px]">{mailStatus === 'sending' ? 'Versturen' : 'Stuur mij de link'}</button>
                    </div>
                    <label className="mt-2 flex items-start gap-2 text-xs text-warm">
                      <input type="checkbox" checked={mailConsent} onChange={(e) => setMailConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                      Ik ga ermee akkoord dat Frederiks mijn ontwerp en e-mailadres gebruikt om contact met me op te nemen.
                    </label>
                    {mailError && <p className="mt-2 text-xs font-medium text-amber-700" role="alert">{mailError}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="no-print mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <button type="button" onClick={back} className={`text-sm font-semibold text-warm hover:text-ink-800 ${step === 0 ? 'invisible' : ''}`}>Terug</button>
          {step < totaalStappen - 1 && <button type="button" onClick={next} className="btn-primary">Volgende</button>}
        </div>
      </div>

      {/* Schetsen per kledingstuk (rug, of zonder foto), voor de PDF en de mail. Niet zichtbaar. */}
      <div id="ontwerp-schetsen" aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0 w-[240px] opacity-0">
        {items.map((i) => (
          <div key={i.id} data-stuk={i.id}>
            <Preview type={i.type} kleur={i.kleur} logo={logo} positie={i.positie} techniek={techniek} foto={i.positie === 'rug' ? (i.artikelFoto ?? i.voorbeeldFoto) : null} />
          </div>
        ))}
      </div>
    </div>
  );
}
