'use client';

/* eslint-disable @next/next/no-img-element -- productfoto's en logo's komen van wisselende bronnen */
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { DrukproefArtikel, DrukproefKleur, DrukproefLogo } from '@/lib/kms/drukproeven';
import DrukproefCompositie, { ZijdeBeeld } from './DrukproefCompositie';
import {
  begrens,
  nieuweId,
  normaliseerHoek,
  plaatsingStijl,
  plaatsingTekst,
  standaardPlek,
  VOORINSTELLINGEN,
  MAX_PLAATSINGEN_PER_ZIJDE,
  type Ontwerp,
  type Plaatsing,
  type Zijde,
} from './ontwerp';
import { bewaarDrukproefActie, kleurenActie, zoekArtikelenActie } from './actions';

/**
 * De drukproef-editor. Jessi kiest een kledingstuk (uit het assortiment van de klant
 * in de vaste kleur, of uit alle artikelen), zet er een of meer logo's op en schuift,
 * schaalt en draait die met de muis of met haar vinger. Voor- en achterkant hebben
 * elk hun eigen tabblad. Onderaan staat precies het beeld dat de klant krijgt.
 *
 * Geen externe bibliotheken: alleen pointer events en CSS-transformaties. Posities
 * worden als percentages van de foto bewaard (zie ontwerp.ts).
 */

export type BestaandeDrukproef = {
  id: string;
  naam: string;
  status: string;
  artikel: DrukproefArtikel | null;
  voor_url: string | null;
  achter_url: string | null;
  ontwerp: Ontwerp;
  techniek: string;
  drukkleuren: number;
  omschrijving: string;
  /** Oude proef zonder ontwerp: we bouwen hem opnieuw op. */
  oudeMaker: boolean;
};

type UploadAntwoord = { ok: true; url: string; naam: string; inBibliotheek?: boolean } | { ok: false; melding: string };
type Sleep = {
  soort: 'verplaats' | 'schaal' | 'draai';
  id: string;
  zijde: Zijde;
  rect: DOMRect;
  startX: number;
  startY: number;
  start: Plaatsing;
  startAfstand: number;
};

const ZIJDE_NAAM: Record<Zijde, string> = { voor: 'Voorkant', achter: 'Achterkant' };
const MAX_MB = 10;
const VERKLEIN_BOVEN = 4 * 1024 * 1024;
const SNAP_MARGE = 1.2; // procent van de fotobreedte
const veld = 'veld !px-3 !py-2 !text-sm';
const label = 'mb-1 block text-xs font-semibold text-ink-700';
const ruit = {
  backgroundImage:
    'linear-gradient(45deg,#e7e7e7 25%,transparent 25%),linear-gradient(-45deg,#e7e7e7 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e7e7e7 75%),linear-gradient(-45deg,transparent 75%,#e7e7e7 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
};

const rond = (n: number) => Math.round(n * 100) / 100;

/** Grote foto's eerst in de browser verkleinen, zodat de upload altijd past. */
async function verklein(file: File): Promise<File> {
  if (file.size <= VERKLEIN_BOVEN || typeof createImageBitmap !== 'function') return file;
  try {
    const beeld = await createImageBitmap(file);
    const schaal = Math.min(1, 2400 / Math.max(beeld.width, beeld.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(beeld.width * schaal));
    canvas.height = Math.max(1, Math.round(beeld.height * schaal));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(beeld, 0, 0, canvas.width, canvas.height);
    // JPG blijft JPG; PNG wordt WebP zodat de doorzichtige achtergrond behouden blijft.
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise<Blob | null>((klaar) => canvas.toBlob(klaar, type, 0.9));
    if (!blob || blob.size >= file.size) return file;
    const basis = file.name.replace(/\.[^.]+$/, '') || 'afbeelding';
    return new File([blob], `${basis}.${type === 'image/jpeg' ? 'jpg' : 'webp'}`, { type });
  } catch {
    return file;
  }
}

async function upload(file: File, soort: 'logo' | 'voorkant' | 'achterkant', extra?: Record<string, string>): Promise<UploadAntwoord> {
  const toegestaan = ['image/png', 'image/jpeg', 'image/webp'];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!toegestaan.includes(file.type) && !['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return { ok: false, melding: 'Dit bestandstype kan niet. Gebruik een PNG, JPG of WebP.' };
  }
  if (file.size > MAX_MB * 1024 * 1024) return { ok: false, melding: 'Dit bestand is groter dan 10 MB. Kies een kleiner bestand.' };
  const fd = new FormData();
  fd.set('bestand', await verklein(file));
  fd.set('soort', soort);
  for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
  try {
    const res = await fetch('/dashboard/drukproeven/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => null)) as UploadAntwoord | null;
    if (!json) return { ok: false, melding: 'Uploaden is niet gelukt. Probeer het nog een keer.' };
    return json;
  } catch {
    return { ok: false, melding: 'Geen verbinding. Controleer je internet en probeer het opnieuw.' };
  }
}

/* ------------------------------------------------------------------------- */
/* Kleine bouwstenen                                                          */
/* ------------------------------------------------------------------------- */

function Stap({ nummer, titel, uitleg, children, rechts }: { nummer: number; titel: string; uitleg?: string; children: ReactNode; rechts?: ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">{nummer}</span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">{titel}</h2>
            {uitleg && <p className="mt-0.5 text-sm text-warm">{uitleg}</p>}
          </div>
        </div>
        {rechts}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ArtikelKaart({ a, onKies, actief }: { a: DrukproefArtikel; onKies: () => void; actief?: boolean }) {
  return (
    <button
      type="button"
      onClick={onKies}
      className={`flex flex-col overflow-hidden rounded-lg border bg-white text-left transition hover:border-amber-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        actief ? 'border-amber-500 ring-2 ring-amber-200' : 'border-line'
      }`}
    >
      <div className="flex h-36 items-center justify-center bg-mist p-2">
        {a.afbeelding ? <img src={a.afbeelding} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-warm">Geen foto</span>}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-sm font-semibold text-ink-900">{a.naam}</p>
        <p className="mt-0.5 text-xs text-warm">{[a.merk, a.kleur ?? (a.sku ? `art. ${a.sku}` : null)].filter(Boolean).join(' · ')}</p>
      </div>
    </button>
  );
}

function UploadKnop({ tekst, onBestand, bezig, klein }: { tekst: string; onBestand: (f: File) => void; bezig?: boolean; klein?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={bezig} onClick={() => ref.current?.click()} className={klein ? 'knop-stil' : 'knop-stil !px-4 !py-2 !text-sm'}>
        {bezig ? 'Bezig met uploaden...' : tekst}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onBestand(f);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------------- */
/* De editor                                                                  */
/* ------------------------------------------------------------------------- */

export default function DrukproefEditor({
  orgId,
  klantNaam,
  orderId,
  assortiment,
  logos: beginLogos,
  bestaand,
}: {
  orgId: string;
  klantNaam: string;
  orderId: string | null;
  assortiment: DrukproefArtikel[];
  logos: DrukproefLogo[];
  bestaand?: BestaandeDrukproef | null;
}) {
  // --- Kledingstuk ---
  const [artikel, setArtikel] = useState<DrukproefArtikel | null>(bestaand?.artikel ?? null);
  const [kiesModus, setKiesModus] = useState<'assortiment' | 'alles'>(assortiment.length > 0 ? 'assortiment' : 'alles');
  const [kiezerOpen, setKiezerOpen] = useState(!bestaand?.artikel && !bestaand?.voor_url);
  const [filter, setFilter] = useState('');
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState<DrukproefArtikel[] | null>(null);
  const [zoekBezig, setZoekBezig] = useState(false);
  const [kleuren, setKleuren] = useState<DrukproefKleur[] | null>(null);
  const [kleurenBezig, setKleurenBezig] = useState(false);

  // --- Foto's ---
  const beginVoorEigen = Boolean(bestaand?.voor_url && (!bestaand.artikel || bestaand.artikel.afbeelding !== bestaand.voor_url));
  const [voorEigen, setVoorEigen] = useState<string | null>(beginVoorEigen ? bestaand?.voor_url ?? null : null);
  const [achterKeuze, setAchterKeuze] = useState<'geen' | 'zelfde' | 'upload'>(
    !bestaand?.achter_url ? 'geen' : bestaand.achter_url === bestaand.voor_url ? 'zelfde' : 'upload',
  );
  const [achterUpload, setAchterUpload] = useState<string | null>(
    bestaand?.achter_url && bestaand.achter_url !== bestaand.voor_url ? bestaand.achter_url : null,
  );
  const voorUrl = voorEigen ?? artikel?.afbeelding ?? null;
  const achterUrl = achterKeuze === 'zelfde' ? voorUrl : achterKeuze === 'upload' ? achterUpload : null;

  // --- Ontwerp ---
  const [ontwerp, setOntwerp] = useState<Ontwerp>(bestaand?.ontwerp ?? { voor: [], achter: [] });
  const [zijde, setZijde] = useState<Zijde>('voor');
  const [geselecteerd, setGeselecteerd] = useState<string | null>(null);
  const [uitlijnhulp, setUitlijnhulp] = useState(true);
  const [gids, setGids] = useState(false);
  const [kanOngedaan, setKanOngedaan] = useState(false);
  const ontwerpRef = useRef(ontwerp);
  const geschiedenis = useRef<Ontwerp[]>([]);
  const sleepRef = useRef<Sleep | null>(null);
  const kaderRef = useRef<HTMLDivElement>(null);
  const werkvlakRef = useRef<HTMLDivElement>(null);
  const gewijzigd = useRef(false);

  useEffect(() => {
    ontwerpRef.current = ontwerp;
  }, [ontwerp]);

  // --- Logo's ---
  const [logos, setLogos] = useState<DrukproefLogo[]>(beginLogos);
  const [bewaarInBibliotheek, setBewaarInBibliotheek] = useState(true);
  const [uploadBezig, setUploadBezig] = useState<null | 'logo' | 'voorkant' | 'achterkant'>(null);

  // --- Gegevens ---
  const beginNaam = bestaand?.naam ?? '';
  const [naam, setNaam] = useState(beginNaam);
  const [naamAuto, setNaamAuto] = useState(!bestaand);
  const [techniek, setTechniek] = useState(bestaand?.techniek === 'bedrukken' ? 'bedrukken' : 'borduren');
  const [drukkleuren, setDrukkleuren] = useState<string>(bestaand?.drukkleuren ? String(bestaand.drukkleuren) : '');
  const [omschrijving, setOmschrijving] = useState(bestaand?.omschrijving ?? '');

  const [melding, setMelding] = useState<string | null>(null);
  const [opslaan, startOpslaan] = useTransition();

  // Waarschuwen bij weggaan met niet-opgeslagen werk.
  useEffect(() => {
    const waarschuw = (e: BeforeUnloadEvent) => {
      if (!gewijzigd.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', waarschuw);
    return () => window.removeEventListener('beforeunload', waarschuw);
  }, []);

  /* ---------------- Kledingstuk kiezen ---------------- */

  const stelNaamVoor = useCallback(
    (a: DrukproefArtikel | null, kleur: string | null) => {
      if (!naamAuto || !a) return;
      setNaam(`${a.naam}${kleur ? ` ${kleur}` : ''}`.slice(0, 160));
    },
    [naamAuto],
  );

  const laadKleuren = useCallback(async (a: DrukproefArtikel) => {
    setKleurenBezig(true);
    setKleuren(null);
    const lijst = await kleurenActie(a.product_id);
    setKleurenBezig(false);
    setKleuren(lijst);
    if (lijst.length === 1) {
      const k = lijst[0];
      setArtikel({ ...a, kleur: k.kleur, afbeelding: k.afbeelding ?? a.afbeelding });
      stelNaamVoor(a, k.kleur);
    }
  }, [stelNaamVoor]);

  function kiesArtikel(a: DrukproefArtikel) {
    gewijzigd.current = true;
    setArtikel(a);
    setVoorEigen(null);
    setKiezerOpen(false);
    setKleuren(null);
    stelNaamVoor(a, a.kleur);
    if (!a.kleur) void laadKleuren(a);
  }

  function kiesKleur(k: DrukproefKleur) {
    if (!artikel) return;
    gewijzigd.current = true;
    setArtikel({ ...artikel, kleur: k.kleur, afbeelding: k.afbeelding ?? artikel.afbeelding });
    setVoorEigen(null);
    stelNaamVoor(artikel, k.kleur);
  }

  // Zoeken in alle artikelen, met een korte pauze na het typen.
  useEffect(() => {
    if (kiesModus !== 'alles') return;
    const term = zoekterm.trim();
    if (term.length < 2) {
      setZoekResultaten(null);
      setZoekBezig(false);
      return;
    }
    let geldig = true;
    const t = setTimeout(async () => {
      setZoekBezig(true);
      const r = await zoekArtikelenActie(term);
      if (!geldig) return;
      setZoekBezig(false);
      setZoekResultaten(r);
    }, 300);
    return () => {
      geldig = false;
      clearTimeout(t);
    };
  }, [zoekterm, kiesModus]);

  const gefilterdAssortiment = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return assortiment;
    return assortiment.filter((a) => `${a.naam} ${a.merk ?? ''} ${a.kleur ?? ''} ${a.sku ?? ''}`.toLowerCase().includes(f));
  }, [assortiment, filter]);

  /* ---------------- Ontwerp bewerken ---------------- */

  const bewaarStap = useCallback(() => {
    geschiedenis.current.push(ontwerpRef.current);
    if (geschiedenis.current.length > 60) geschiedenis.current.shift();
    setKanOngedaan(true);
    gewijzigd.current = true;
  }, []);

  function ongedaanMaken() {
    const vorige = geschiedenis.current.pop();
    if (vorige) {
      setOntwerp(vorige);
      if (geselecteerd && ![...vorige.voor, ...vorige.achter].some((p) => p.id === geselecteerd)) setGeselecteerd(null);
    }
    setKanOngedaan(geschiedenis.current.length > 0);
  }

  const wijzig = useCallback((z: Zijde, id: string, patch: Partial<Plaatsing>) => {
    setOntwerp((o) => ({ ...o, [z]: o[z].map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  /** Wijziging vanuit een knop of veld: eerst een stap bewaren voor ongedaan maken. */
  function wijzigMetStap(id: string, patch: Partial<Plaatsing>) {
    bewaarStap();
    wijzig(zijde, id, patch);
  }

  function voegLogoToe(url: string) {
    if (ontwerp[zijde].length >= MAX_PLAATSINGEN_PER_ZIJDE) {
      setMelding(`Er passen maximaal ${MAX_PLAATSINGEN_PER_ZIJDE} logo's op één kant.`);
      return;
    }
    bewaarStap();
    const plek = standaardPlek(zijde);
    const nieuw: Plaatsing = { id: nieuweId(), logo_url: url, x: plek.x, y: plek.y, breedte: plek.breedte, rotatie: 0, label: plek.label };
    setOntwerp((o) => ({ ...o, [zijde]: [...o[zijde], nieuw] }));
    setGeselecteerd(nieuw.id);
    setMelding(null);
  }

  function verwijder(id: string) {
    bewaarStap();
    setOntwerp((o) => ({ ...o, [zijde]: o[zijde].filter((p) => p.id !== id) }));
    setGeselecteerd(null);
  }

  function dupliceer(p: Plaatsing) {
    if (ontwerp[zijde].length >= MAX_PLAATSINGEN_PER_ZIJDE) return;
    bewaarStap();
    const kopie: Plaatsing = { ...p, id: nieuweId(), x: rond(begrens(p.x + 4, 0, 100)), y: rond(begrens(p.y + 4, 0, 100)) };
    setOntwerp((o) => ({ ...o, [zijde]: [...o[zijde], kopie] }));
    setGeselecteerd(kopie.id);
  }

  function naarAndereKant(p: Plaatsing) {
    const andere: Zijde = zijde === 'voor' ? 'achter' : 'voor';
    if (ontwerp[andere].length >= MAX_PLAATSINGEN_PER_ZIJDE) return;
    bewaarStap();
    const plek = standaardPlek(andere);
    const kopie: Plaatsing = { ...p, id: nieuweId(), x: plek.x, y: plek.y, breedte: plek.breedte, rotatie: 0, label: plek.label, breedte_cm: undefined, toelichting: undefined };
    setOntwerp((o) => ({ ...o, [andere]: [...o[andere], kopie] }));
    if (andere === 'achter' && achterKeuze === 'geen') setAchterKeuze('zelfde');
    setZijde(andere);
    setGeselecteerd(kopie.id);
  }

  /* ---------------- Slepen, schalen, draaien ---------------- */

  function beginSleep(e: ReactPointerEvent<HTMLElement>, soort: Sleep['soort'], p: Plaatsing) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    const kader = kaderRef.current;
    if (!kader) return;
    const rect = kader.getBoundingClientRect();
    const cx = rect.left + (p.x / 100) * rect.width;
    const cy = rect.top + (p.y / 100) * rect.height;
    bewaarStap();
    setGeselecteerd(p.id);
    // Focus op het werkvlak, zodat de pijltjestoetsen daarna meteen werken.
    werkvlakRef.current?.focus({ preventScroll: true });
    sleepRef.current = {
      soort,
      id: p.id,
      zijde,
      rect,
      startX: e.clientX,
      startY: e.clientY,
      start: p,
      startAfstand: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* niet elke browser staat dit toe; slepen werkt dan alleen binnen het element */
    }
  }

  function beweeg(e: ReactPointerEvent<HTMLElement>) {
    const s = sleepRef.current;
    if (!s) return;
    e.preventDefault();
    const { rect, start } = s;
    if (s.soort === 'verplaats') {
      let x = start.x + ((e.clientX - s.startX) / rect.width) * 100;
      let y = start.y + ((e.clientY - s.startY) / rect.height) * 100;
      x = begrens(x, 0, 100);
      y = begrens(y, 0, 100);
      let opMidden = false;
      if (uitlijnhulp && !e.altKey && Math.abs(x - 50) < SNAP_MARGE) {
        x = 50;
        opMidden = true;
      }
      setGids(opMidden);
      wijzig(s.zijde, s.id, { x: rond(x), y: rond(y) });
      return;
    }
    const cx = rect.left + (start.x / 100) * rect.width;
    const cy = rect.top + (start.y / 100) * rect.height;
    if (s.soort === 'schaal') {
      const afstand = Math.hypot(e.clientX - cx, e.clientY - cy);
      const breedte = begrens(start.breedte * (afstand / s.startAfstand), 1, 100);
      wijzig(s.zijde, s.id, { breedte: rond(breedte) });
      return;
    }
    // Draaien: de greep staat recht boven het midden, dus 0 graden = naar boven.
    let hoek = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
    if (e.shiftKey) hoek = Math.round(hoek / 15) * 15;
    else {
      const recht = Math.round(hoek / 90) * 90;
      if (Math.abs(hoek - recht) < 4) hoek = recht;
    }
    wijzig(s.zijde, s.id, { rotatie: normaliseerHoek(hoek) });
  }

  function stopSleep(e: ReactPointerEvent<HTMLElement>) {
    if (!sleepRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* al losgelaten */
    }
    sleepRef.current = null;
    setGids(false);
  }

  function toets(e: ReactKeyboardEvent<HTMLDivElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      ongedaanMaken();
      return;
    }
    const p = ontwerp[zijde].find((q) => q.id === geselecteerd);
    if (!p) return;
    const stap = e.shiftKey ? 2 : 0.5;
    const pijlen: Record<string, [number, number]> = { ArrowLeft: [-stap, 0], ArrowRight: [stap, 0], ArrowUp: [0, -stap], ArrowDown: [0, stap] };
    if (pijlen[e.key]) {
      e.preventDefault();
      bewaarStap();
      const [dx, dy] = pijlen[e.key];
      wijzig(zijde, p.id, { x: rond(begrens(p.x + dx, 0, 100)), y: rond(begrens(p.y + dy, 0, 100)) });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      verwijder(p.id);
    } else if (e.key === 'Escape') {
      setGeselecteerd(null);
    }
  }

  /* ---------------- Uploads ---------------- */

  async function uploadLogo(f: File) {
    setUploadBezig('logo');
    setMelding(null);
    const r = await upload(f, 'logo', bewaarInBibliotheek ? { org_id: orgId, bewaar_logo: '1' } : undefined);
    setUploadBezig(null);
    if (!r.ok) {
      setMelding(r.melding);
      return;
    }
    const naamZonderExt = r.naam.replace(/\.[^.]+$/, '') || 'Nieuw logo';
    setLogos((l) => [...l, { id: `upload-${nieuweId()}`, naam: naamZonderExt, url: r.url }]);
    voegLogoToe(r.url);
  }

  async function uploadFoto(f: File, soort: 'voorkant' | 'achterkant') {
    setUploadBezig(soort);
    setMelding(null);
    const r = await upload(f, soort);
    setUploadBezig(null);
    if (!r.ok) {
      setMelding(r.melding);
      return;
    }
    gewijzigd.current = true;
    if (soort === 'voorkant') {
      setVoorEigen(r.url);
      setKiezerOpen(false);
    } else {
      setAchterUpload(r.url);
      setAchterKeuze('upload');
    }
  }

  /* ---------------- Opslaan ---------------- */

  function bewaar() {
    setMelding(null);
    if (!naam.trim()) {
      setMelding('Geef de drukproef een naam (stap 3).');
      return;
    }
    if (!voorUrl && !achterUrl) {
      setMelding('Kies eerst een kledingstuk of upload een foto (stap 1).');
      return;
    }
    if (ontwerp.voor.length + ontwerp.achter.length === 0) {
      setMelding('Zet minstens één logo op het kledingstuk (stap 2).');
      return;
    }
    // Logo's op een kant zonder foto tellen niet mee.
    const teBewaren: Ontwerp = { voor: voorUrl ? ontwerp.voor : [], achter: achterUrl ? ontwerp.achter : [] };
    startOpslaan(async () => {
      gewijzigd.current = false;
      const r = await bewaarDrukproefActie({
        id: bestaand?.id ?? null,
        org_id: orgId,
        order_id: orderId,
        naam: naam.trim(),
        product_id: artikel?.product_id ?? null,
        product_kleur: artikel?.kleur ?? null,
        voor_url: voorUrl,
        achter_url: achterUrl,
        ontwerp: teBewaren,
        techniek,
        drukkleuren: Number(drukkleuren) || 0,
        omschrijving,
      });
      if (r && !r.ok) {
        gewijzigd.current = true;
        setMelding(r.melding);
      }
    });
  }

  /* ---------------- Weergave ---------------- */

  const lagen = ontwerp[zijde];
  const actief = lagen.find((p) => p.id === geselecteerd) ?? null;
  const huidigeFoto = zijde === 'voor' ? voorUrl : achterUrl;
  const toonCanvas = zijde === 'voor' ? Boolean(voorUrl) : achterKeuze !== 'geen' && Boolean(achterUrl);
  const voorinstellingen = VOORINSTELLINGEN.filter((v) => v.zijde === zijde);
  const beslist = bestaand && (bestaand.status === 'goedgekeurd' || bestaand.status === 'afgekeurd');

  return (
    <div className="flex flex-col gap-5">
      {bestaand?.oudeMaker && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Deze drukproef is gemaakt met de oude maker. Kies hieronder een kledingstuk en zet het logo erop; bij opslaan wordt hij vervangen door de nieuwe versie.
        </div>
      )}
      {beslist && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          De klant heeft deze drukproef al {bestaand.status === 'goedgekeurd' ? 'goedgekeurd' : 'afgekeurd'}. Sla je wijzigingen op, dan gaat hij terug naar concept en kun je hem opnieuw versturen.
        </div>
      )}

      {/* ---------------- Stap 1: kledingstuk ---------------- */}
      <Stap
        nummer={1}
        titel="Kies het kledingstuk"
        uitleg={`Uit het assortiment van ${klantNaam} (in hun vaste kleur), of zoek in alle artikelen.`}
        rechts={
          !kiezerOpen && (artikel || voorEigen) ? (
            <button type="button" className="knop-stil !px-4 !py-2 !text-sm" onClick={() => setKiezerOpen(true)}>
              Ander kledingstuk kiezen
            </button>
          ) : null
        }
      >
        {!kiezerOpen && (artikel || voorEigen) ? (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-line bg-mist p-1.5">
              {voorUrl ? <img src={voorUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-warm">Geen foto</span>}
            </div>
            <div className="min-w-0 flex-1">
              {artikel ? (
                <>
                  <p className="text-base font-semibold text-ink-900">{artikel.naam}</p>
                  <p className="text-sm text-warm">{[artikel.merk, artikel.sku ? `art. ${artikel.sku}` : null].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-sm text-ink-800">
                    Kleur: <span className="font-semibold">{artikel.kleur ?? 'nog niet gekozen'}</span>
                  </p>
                </>
              ) : (
                <p className="text-base font-semibold text-ink-900">Eigen foto</p>
              )}
              {voorEigen && artikel && <p className="mt-1 text-xs text-warm">Je gebruikt een eigen foto voor de voorkant.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {artikel && (
                  <button type="button" className="knop-stil" onClick={() => void laadKleuren(artikel)}>
                    Andere kleur
                  </button>
                )}
                <UploadKnop klein tekst="Eigen foto voorkant uploaden" bezig={uploadBezig === 'voorkant'} onBestand={(f) => void uploadFoto(f, 'voorkant')} />
                {voorEigen && artikel?.afbeelding && (
                  <button type="button" className="knop-tekst" onClick={() => setVoorEigen(null)}>
                    Terug naar de artikelfoto
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="inline-flex rounded-lg border border-line bg-mist p-1">
              {(['assortiment', 'alles'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setKiesModus(m)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${kiesModus === m ? 'bg-white text-ink-900 shadow-sm' : 'text-warm hover:text-ink-900'}`}
                >
                  {m === 'assortiment' ? `Assortiment ${klantNaam} (${assortiment.length})` : 'Alle artikelen'}
                </button>
              ))}
            </div>

            {kiesModus === 'assortiment' ? (
              assortiment.length === 0 ? (
                <p className="mt-4 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-warm">
                  {klantNaam} heeft nog geen artikelen in het assortiment. Zoek in alle artikelen of upload een eigen foto.
                </p>
              ) : (
                <>
                  {assortiment.length > 8 && (
                    <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Zoek in het assortiment..." className={`${veld} mt-4 max-w-sm`} />
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {gefilterdAssortiment.map((a) => (
                      <ArtikelKaart key={`${a.product_id}|${a.kleur ?? ''}`} a={a} onKies={() => kiesArtikel(a)} actief={artikel?.product_id === a.product_id && artikel?.kleur === a.kleur} />
                    ))}
                  </div>
                </>
              )
            ) : (
              <div className="mt-4">
                <input
                  value={zoekterm}
                  onChange={(e) => setZoekterm(e.target.value)}
                  placeholder="Zoek op naam, merk of artikelnummer, bijvoorbeeld 'polo' of 'Snickers'"
                  className={`${veld} max-w-lg`}
                  autoFocus
                />
                {zoekBezig && <p className="mt-3 text-sm text-warm">Zoeken...</p>}
                {!zoekBezig && zoekResultaten && zoekResultaten.length === 0 && <p className="mt-3 text-sm text-warm">Niets gevonden. Probeer een ander woord.</p>}
                {zoekResultaten && zoekResultaten.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {zoekResultaten.map((a) => (
                      <ArtikelKaart key={a.product_id} a={a} onKies={() => kiesArtikel(a)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <span className="text-sm text-warm">Staat het kledingstuk niet in de lijst?</span>
              <UploadKnop tekst="Eigen foto uploaden" bezig={uploadBezig === 'voorkant'} onBestand={(f) => void uploadFoto(f, 'voorkant')} />
              {(artikel || voorEigen) && (
                <button type="button" className="knop-tekst" onClick={() => setKiezerOpen(false)}>
                  Annuleren
                </button>
              )}
            </div>
          </div>
        )}

        {/* Kleur kiezen */}
        {(kleurenBezig || (kleuren && kleuren.length > 1) || (kleuren && kleuren.length === 0 && artikel && !artikel.kleur)) && !kiezerOpen && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink-900">Kies de kleur van het kledingstuk</p>
            {kleurenBezig && <p className="mt-2 text-sm text-warm">Kleuren ophalen...</p>}
            {kleuren && kleuren.length === 0 && <p className="mt-2 text-sm text-warm">Dit artikel heeft geen kleuren in de catalogus. We gebruiken de hoofdfoto.</p>}
            {kleuren && kleuren.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {kleuren.map((k) => (
                  <button
                    key={k.kleur}
                    type="button"
                    onClick={() => kiesKleur(k)}
                    className={`flex items-center gap-2 rounded-lg border bg-white py-1.5 pl-1.5 pr-3 text-sm transition hover:border-amber-400 ${
                      artikel?.kleur === k.kleur ? 'border-amber-500 ring-2 ring-amber-200' : 'border-line'
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-mist">
                      {k.afbeelding ? <img src={k.afbeelding} alt="" className="max-h-full max-w-full object-contain" /> : null}
                    </span>
                    {k.kleur}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Stap>

      {/* ---------------- Stap 2: logo's plaatsen ---------------- */}
      <Stap
        nummer={2}
        titel="Zet het logo op de juiste plek"
        uitleg="Sleep het logo met de muis of je vinger. Het hoekje rechtsonder maakt het groter of kleiner, het bolletje erboven draait het."
        rechts={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" checked={uitlijnhulp} onChange={(e) => setUitlijnhulp(e.target.checked)} className="h-4 w-4 accent-amber-500" />
              Uitlijnhulp (midden)
            </label>
            <button type="button" className="knop-stil" disabled={!kanOngedaan} onClick={ongedaanMaken}>
              Ongedaan maken
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-line">
          {(['voor', 'achter'] as Zijde[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => {
                setZijde(z);
                setGeselecteerd(null);
              }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
                zijde === z ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'
              }`}
            >
              {ZIJDE_NAAM[z]}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${zijde === z ? 'bg-amber-100 text-amber-800' : 'bg-mist text-warm'}`}>{ontwerp[z].length}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-5">
          {/* Het werkvlak */}
          <div className="lg:col-span-3">
            {zijde === 'achter' && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">Foto achterkant:</span>
                <button
                  type="button"
                  onClick={() => setAchterKeuze('zelfde')}
                  disabled={!voorUrl}
                  className={`chip ${achterKeuze === 'zelfde' ? 'chip-aan' : ''}`}
                >
                  Zelfde foto als voorkant
                </button>
                <UploadKnop klein tekst={achterUpload ? 'Andere foto uploaden' : 'Foto achterkant uploaden'} bezig={uploadBezig === 'achterkant'} onBestand={(f) => void uploadFoto(f, 'achterkant')} />
                {achterUpload && achterKeuze !== 'upload' && (
                  <button type="button" onClick={() => setAchterKeuze('upload')} className="chip">
                    Geüploade foto gebruiken
                  </button>
                )}
                {achterKeuze !== 'geen' && (
                  <button type="button" onClick={() => setAchterKeuze('geen')} className="knop-tekst">
                    Geen achterkant
                  </button>
                )}
              </div>
            )}

            {toonCanvas ? (
              <div
                ref={werkvlakRef}
                tabIndex={0}
                onKeyDown={toets}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setGeselecteerd(null);
                }}
                className="rounded-xl border border-line bg-mist p-4 outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                aria-label={`Werkvlak ${ZIJDE_NAAM[zijde].toLowerCase()}`}
              >
                <ZijdeBeeld afbeeldingUrl={huidigeFoto} plaatsingen={lagen} formaat="groot" alt={ZIJDE_NAAM[zijde]} toonLogos={false} kaderRef={kaderRef}>
                  {/* Klik op de foto zelf = selectie opheffen */}
                  <div
                    className="absolute inset-0"
                    onPointerDown={() => {
                      setGeselecteerd(null);
                      werkvlakRef.current?.focus({ preventScroll: true });
                    }}
                  />
                  {gids && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0 border-l-2 border-dashed border-amber-500" />}
                  {lagen.map((p) => {
                    const isActief = p.id === geselecteerd;
                    return (
                      <div
                        key={p.id}
                        style={{ ...plaatsingStijl(p), touchAction: 'none' }}
                        className={`cursor-move ${isActief ? 'z-10 outline-dashed outline-2 outline-offset-2 outline-amber-500' : 'hover:outline-dashed hover:outline-1 hover:outline-amber-400'}`}
                        onPointerDown={(e) => beginSleep(e, 'verplaats', p)}
                        onPointerMove={beweeg}
                        onPointerUp={stopSleep}
                        onPointerCancel={stopSleep}
                      >
                        <img src={p.logo_url} alt="Logo" draggable={false} className="pointer-events-none block h-auto w-full" />
                        {isActief && (
                          <>
                            <span className="pointer-events-none absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-amber-500" />
                            <button
                              type="button"
                              aria-label="Draaien"
                              title="Sleep om te draaien (Shift = stappen van 15 graden)"
                              style={{ touchAction: 'none' }}
                              className="absolute -top-9 left-1/2 h-6 w-6 -translate-x-1/2 cursor-grab rounded-full border-2 border-amber-500 bg-white shadow"
                              onPointerDown={(e) => beginSleep(e, 'draai', p)}
                              onPointerMove={beweeg}
                              onPointerUp={stopSleep}
                              onPointerCancel={stopSleep}
                            />
                            <button
                              type="button"
                              aria-label="Groter of kleiner maken"
                              title="Sleep om groter of kleiner te maken"
                              style={{ touchAction: 'none' }}
                              className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded-sm border-2 border-amber-500 bg-white shadow"
                              onPointerDown={(e) => beginSleep(e, 'schaal', p)}
                              onPointerMove={beweeg}
                              onPointerUp={stopSleep}
                              onPointerCancel={stopSleep}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </ZijdeBeeld>
                <p className="mt-3 text-center text-xs text-warm">
                  Tip: met de pijltjestoetsen schuif je het gekozen logo precies (Shift = grotere stap). Delete verwijdert het. Ctrl+Z maakt ongedaan.
                </p>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-mist p-6 text-center">
                {zijde === 'voor' ? (
                  <p className="text-sm text-warm">Kies eerst in stap 1 een kledingstuk of upload een foto.</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink-900">Nog geen achterkant</p>
                    <p className="max-w-sm text-sm text-warm">
                      De catalogus heeft geen foto&apos;s van de achterkant. Upload er zelf een, of gebruik de voorkantfoto als ondergrond.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bediening */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <div>
              <p className="text-sm font-semibold text-ink-900">Logo toevoegen aan de {ZIJDE_NAAM[zijde].toLowerCase()}</p>
              {logos.length === 0 ? (
                <p className="mt-1 text-sm text-warm">Nog geen logo&apos;s bij {klantNaam}. Upload hieronder een PNG.</p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {logos.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!toonCanvas}
                      onClick={() => voegLogoToe(l.url)}
                      title={toonCanvas ? `${l.naam} op de ${ZIJDE_NAAM[zijde].toLowerCase()} zetten` : 'Kies eerst een foto'}
                      className="flex flex-col items-center gap-1 rounded-lg border border-line bg-white p-1.5 text-center transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex h-14 w-full items-center justify-center rounded" style={ruit}>
                        <img src={l.url} alt="" className="max-h-12 max-w-full object-contain" />
                      </span>
                      <span className="line-clamp-1 w-full text-[11px] text-ink-700">{l.naam}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <UploadKnop tekst="Nieuw logo uploaden (PNG)" bezig={uploadBezig === 'logo'} onBestand={(f) => (toonCanvas ? void uploadLogo(f) : setMelding('Kies eerst een foto voor deze kant.'))} />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-700">
                  <input type="checkbox" checked={bewaarInBibliotheek} onChange={(e) => setBewaarInBibliotheek(e.target.checked)} className="h-4 w-4 accent-amber-500" />
                  Ook bewaren bij de logo&apos;s van {klantNaam}
                </label>
              </div>
              <p className="veld-hint">Gebruik bij voorkeur een PNG met doorzichtige achtergrond. Maximaal 10 MB.</p>
              {melding && (
                <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                  {melding}
                </p>
              )}
            </div>

            {lagen.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-ink-900">Logo&apos;s op de {ZIJDE_NAAM[zijde].toLowerCase()}</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {lagen.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setGeselecteerd(p.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                          p.id === geselecteerd ? 'border-amber-500 bg-amber-50' : 'border-line bg-white hover:bg-mist'
                        }`}
                      >
                        <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded" style={ruit}>
                          <img src={p.logo_url} alt="" className="max-h-7 max-w-full object-contain" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{plaatsingTekst(p) || `Logo ${i + 1}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actief ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-sm font-semibold text-ink-900">Gekozen logo</p>

                <div className="mt-3">
                  <span className={label}>Snel op een vaste plek zetten</span>
                  <div className="flex flex-wrap gap-1.5">
                    {voorinstellingen.map((v) => (
                      <button key={v.label} type="button" className="chip" onClick={() => wijzigMetStap(actief.id, { x: v.x, y: v.y, breedte: v.breedte, rotatie: 0, label: v.label })}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className={label} htmlFor="dp-grootte">
                    Grootte op de foto ({Math.round(actief.breedte)}% van de breedte)
                  </label>
                  <input
                    id="dp-grootte"
                    type="range"
                    min={1}
                    max={100}
                    step={0.5}
                    value={actief.breedte}
                    onPointerDown={bewaarStap}
                    onKeyDown={bewaarStap}
                    onChange={(e) => wijzig(zijde, actief.id, { breedte: rond(begrens(Number(e.target.value), 1, 100)) })}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="mt-3">
                  <label className={label} htmlFor="dp-draai">
                    Draaien ({Math.round(actief.rotatie)} graden)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="dp-draai"
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={actief.rotatie}
                      onPointerDown={bewaarStap}
                      onKeyDown={bewaarStap}
                      onChange={(e) => wijzig(zijde, actief.id, { rotatie: normaliseerHoek(Number(e.target.value)) })}
                      className="w-full accent-amber-500"
                    />
                    <button type="button" className="knop-stil shrink-0" onClick={() => wijzigMetStap(actief.id, { rotatie: 0 })}>
                      Recht
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="dp-plek">Plek</label>
                    <input
                      id="dp-plek"
                      list="dp-plekken"
                      value={actief.label ?? ''}
                      maxLength={80}
                      placeholder="Bijv. Linker borst"
                      onFocus={bewaarStap}
                      onChange={(e) => wijzig(zijde, actief.id, { label: e.target.value })}
                      className={veld}
                    />
                    <datalist id="dp-plekken">
                      {VOORINSTELLINGEN.map((v) => (
                        <option key={v.label} value={v.label} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={label} htmlFor="dp-cm">Breedte in het echt (cm)</label>
                    <input
                      id="dp-cm"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={actief.breedte_cm ?? ''}
                      placeholder="Bijv. 12"
                      onFocus={bewaarStap}
                      onChange={(e) => wijzig(zijde, actief.id, { breedte_cm: e.target.value === '' ? null : Number(e.target.value) })}
                      className={veld}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label} htmlFor="dp-toelichting">Maatvoering of toelichting</label>
                    <input
                      id="dp-toelichting"
                      value={actief.toelichting ?? ''}
                      maxLength={160}
                      placeholder="Bijv. 3 cm onder de naad"
                      onFocus={bewaarStap}
                      onChange={(e) => wijzig(zijde, actief.id, { toelichting: e.target.value })}
                      className={veld}
                    />
                    {plaatsingTekst(actief) && <p className="veld-hint">Op de proef: {plaatsingTekst(actief)}</p>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="knop-stil" onClick={() => wijzigMetStap(actief.id, { x: 50 })}>
                    In het midden
                  </button>
                  <button type="button" className="knop-stil" onClick={() => dupliceer(actief)}>
                    Dupliceren
                  </button>
                  <button type="button" className="knop-stil" onClick={() => naarAndereKant(actief)}>
                    Ook op de {zijde === 'voor' ? 'achterkant' : 'voorkant'}
                  </button>
                  <button type="button" className="knop rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={() => verwijder(actief.id)}>
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              lagen.length > 0 && <p className="text-sm text-warm">Klik op een logo om het aan te passen.</p>
            )}
          </div>
        </div>
      </Stap>

      {/* ---------------- Stap 3: gegevens en opslaan ---------------- */}
      <Stap nummer={3} titel="Gegevens en opslaan" uitleg="Dit is precies wat de klant te zien krijgt.">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="mb-3 font-display text-base font-bold text-ink-900">{naam || 'Drukproef'}</p>
              {voorUrl || achterUrl ? (
                <DrukproefCompositie
                  ontwerp={{ voor: voorUrl ? ontwerp.voor : [], achter: achterUrl ? ontwerp.achter : [] }}
                  voorUrl={voorUrl}
                  achterUrl={achterUrl}
                  titel={artikel?.naam}
                />
              ) : (
                <p className="text-sm text-warm">Het voorbeeld verschijnt zodra je een kledingstuk hebt gekozen.</p>
              )}
              {omschrijving.trim() && <p className="mt-4 whitespace-pre-line border-t border-line pt-3 text-sm text-ink-800">{omschrijving}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-2">
            <div>
              <label className={label} htmlFor="dp-naam">Naam van de drukproef</label>
              <input
                id="dp-naam"
                value={naam}
                maxLength={160}
                onChange={(e) => {
                  setNaam(e.target.value);
                  setNaamAuto(false);
                  gewijzigd.current = true;
                }}
                placeholder="Bijv. Polo antraciet, logo borst en rug"
                className={veld}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="dp-techniek">Techniek</label>
                <select id="dp-techniek" value={techniek} onChange={(e) => setTechniek(e.target.value)} className={veld}>
                  <option value="borduren">Borduren</option>
                  <option value="bedrukken">Bedrukken</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="dp-drukkleuren">Aantal kleuren in het logo</label>
                <input
                  id="dp-drukkleuren"
                  type="number"
                  min={0}
                  max={20}
                  inputMode="numeric"
                  value={drukkleuren}
                  onChange={(e) => setDrukkleuren(e.target.value)}
                  placeholder="Bijv. 2"
                  className={veld}
                />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="dp-omschrijving">Instructies voor productie en klant</label>
              <textarea
                id="dp-omschrijving"
                rows={5}
                value={omschrijving}
                maxLength={2000}
                onChange={(e) => {
                  setOmschrijving(e.target.value);
                  gewijzigd.current = true;
                }}
                placeholder={'Bijv. Bij werkjasjes de FHB-batch op de mouw eraf tornen.'}
                className={veld}
              />
            </div>

            {melding && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {melding}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={bewaar} disabled={opslaan} className="knop-primair !px-5 !py-2.5 !text-sm">
                {opslaan ? 'Bezig met opslaan...' : bestaand ? 'Wijzigingen opslaan' : 'Drukproef opslaan'}
              </button>
              <Link href={`/dashboard/drukproeven?org=${orgId}`} className="knop-tekst">
                Annuleren
              </Link>
            </div>
          </div>
        </div>
      </Stap>
    </div>
  );
}
