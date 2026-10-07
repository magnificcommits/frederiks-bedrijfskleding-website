'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  leesMand,
  mandSleutel,
  totaalStuks,
  voegToe as voegToeMand,
  werkBij as werkBijMand,
  type MandRegel,
} from '@/lib/offerteMand';

/**
 * Offertemandje: artikelen verzamelen, per artikel kleur, aantallen per maat en
 * logoplek kiezen, en er in één keer een offerte voor aanvragen.
 *
 * Opslag in localStorage met een houdbaarheid van 30 dagen. Een inkoper stelt
 * een pakket vaak in een paar sessies samen of overlegt eerst met een collega;
 * sessionStorage (de vorige opzet) was dan al leeg. Alles blijft in de browser
 * van de bezoeker; er gaat pas iets naar ons bij het versturen.
 */

/** Wat een productkaart weet: genoeg om het artikel zonder kleur en maat in het mandje te leggen. */
export type SelectieItem = {
  id: string;
  naam: string;
  merk: string | null;
  categorieSlug: string | null;
  slug: string;
  foto: string | null;
  kleuren?: string[];
  maten?: string[];
};

type Ctx = {
  items: MandRegel[];
  stuks: number;
  gekozen: (productId: string) => boolean;
  /** Kaartknop: artikel erin (zonder kleur en maat) of alle regels van dat artikel eruit. */
  wissel: (item: SelectieItem) => void;
  voegToe: (regel: MandRegel) => void;
  werkBij: (sleutel: string, patch: Parameters<typeof werkBijMand>[2]) => void;
  verwijder: (sleutel: string) => void;
  leegmaken: () => void;
  klaar: boolean;
};

const SLEUTEL = 'fb-offertemand';
const OUDE_SLEUTEL = 'fb-offerte-selectie';
const HOUDBAAR_MS = 30 * 24 * 3600 * 1000;
const OfferteSelectieContext = createContext<Ctx | null>(null);

export function itemNaarRegel(item: SelectieItem): MandRegel {
  return {
    sleutel: mandSleutel(item.id, null),
    productId: item.id,
    naam: item.naam,
    merk: item.merk,
    categorieSlug: item.categorieSlug,
    slug: item.slug,
    foto: item.foto,
    kleuren: item.kleuren ?? [],
    maten: item.maten ?? [],
    kleur: null,
    aantallen: {},
    aantalZonderMaat: 0,
    logo: null,
  };
}

function leesOpslag(): MandRegel[] {
  try {
    const ruw = window.localStorage.getItem(SLEUTEL);
    if (ruw) {
      const d = JSON.parse(ruw) as { t?: number; items?: unknown };
      if (d.t && Date.now() - d.t < HOUDBAAR_MS) return leesMand(d.items);
      return [];
    }
    // Eenmalig overzetten uit de oude selectie (sessionStorage).
    const oud = window.sessionStorage.getItem(OUDE_SLEUTEL);
    if (oud) {
      window.sessionStorage.removeItem(OUDE_SLEUTEL);
      return leesMand(JSON.parse(oud));
    }
  } catch {
    /* privémodus of kapotte waarde: dan een leeg mandje */
  }
  return [];
}

export function OfferteSelectieProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MandRegel[]>([]);
  // `klaar` voorkomt dat de balk kort verkeerd flitst voordat de opslag gelezen is.
  const [klaar, setKlaar] = useState(false);

  useEffect(() => {
    setItems(leesOpslag());
    setKlaar(true);
    // Mandje gelijk houden tussen tabbladen.
    const opWijziging = (e: StorageEvent) => {
      if (e.key === SLEUTEL) setItems(leesOpslag());
    };
    window.addEventListener('storage', opWijziging);
    return () => window.removeEventListener('storage', opWijziging);
  }, []);

  useEffect(() => {
    if (!klaar) return;
    try {
      if (items.length) window.localStorage.setItem(SLEUTEL, JSON.stringify({ t: Date.now(), items }));
      else window.localStorage.removeItem(SLEUTEL);
    } catch {
      /* vol quotum of geblokkeerd: dan werkt het mandje alleen op deze pagina */
    }
  }, [items, klaar]);

  const voegToe = useCallback((regel: MandRegel) => setItems((h) => voegToeMand(h, regel)), []);
  const werkBij = useCallback<Ctx['werkBij']>((sleutel, patch) => setItems((h) => werkBijMand(h, sleutel, patch)), []);
  const wissel = useCallback((item: SelectieItem) => {
    setItems((h) => (h.some((x) => x.productId === item.id) ? h.filter((x) => x.productId !== item.id) : voegToeMand(h, itemNaarRegel(item))));
  }, []);
  const verwijder = useCallback((sleutel: string) => setItems((h) => h.filter((x) => x.sleutel !== sleutel)), []);
  const leegmaken = useCallback(() => setItems([]), []);
  const gekozen = useCallback((id: string) => items.some((x) => x.productId === id), [items]);

  const waarde = useMemo<Ctx>(
    () => ({ items, stuks: totaalStuks(items), gekozen, wissel, voegToe, werkBij, verwijder, leegmaken, klaar }),
    [items, gekozen, wissel, voegToe, werkBij, verwijder, leegmaken, klaar],
  );

  return <OfferteSelectieContext.Provider value={waarde}>{children}</OfferteSelectieContext.Provider>;
}

/**
 * Buiten de provider (bijvoorbeeld in het dashboard) geeft dit een leeg mandje
 * terug in plaats van een fout.
 */
export function useOfferteSelectie(): Ctx {
  const ctx = useContext(OfferteSelectieContext);
  return (
    ctx ?? {
      items: [],
      stuks: 0,
      gekozen: () => false,
      wissel: () => {},
      voegToe: () => {},
      werkBij: () => {},
      verwijder: () => {},
      leegmaken: () => {},
      klaar: false,
    }
  );
}

/** Knop rechtsboven op een productkaart. */
export function SelectieKnop({
  item,
  className = '',
  labels,
}: {
  item: SelectieItem;
  className?: string;
  labels?: { uit: string; aan: string };
}) {
  const { gekozen, wissel } = useOfferteSelectie();
  const aan = gekozen(item.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        // De kaart is een link; deze knop ligt eroverheen en mag niet doorklikken.
        e.preventDefault();
        e.stopPropagation();
        wissel(item);
      }}
      aria-pressed={aan}
      title={aan ? 'Uit je offerte halen' : 'In je offerte zetten'}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition ${
        aan
          ? 'border-amber-500 bg-amber-500 text-ink-900'
          : 'border-line bg-white/95 text-ink-700 hover:border-amber-400'
      } ${className}`}
    >
      <span aria-hidden="true">{aan ? '✓' : '+'}</span>
      <span className="sr-only sm:not-sr-only">
        {aan ? (labels?.aan ?? 'In offerte') : (labels?.uit ?? 'Offerte')}
      </span>
    </button>
  );
}

/** Teller voor in de kop: "Mijn offerte (3)" zodra er iets in zit. */
export function MandKnop({ className = '', onClick, sub }: { className?: string; onClick?: () => void; sub?: React.ReactNode }) {
  const { items, klaar } = useOfferteSelectie();
  const n = klaar ? items.length : 0;
  return (
    <Link href="/offerte" className={className} onClick={onClick} data-cta="offerte">
      {n > 0 ? (
        <>
          Mijn offerte
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-900 px-1.5 text-[11px] font-bold text-white tabular-nums">
            {n}
          </span>
        </>
      ) : (
        <>
          Offerte aanvragen
          {sub}
        </>
      )}
    </Link>
  );
}

/** Vaste balk onderin zodra er iets in het mandje zit (niet op de offertepagina zelf). */
export function OfferteBalk() {
  const { items, stuks, leegmaken, klaar } = useOfferteSelectie();
  const pad = usePathname() ?? '';
  if (!klaar || items.length === 0 || pad.startsWith('/offerte') || pad.startsWith('/dashboard') || pad.startsWith('/portaal')) return null;

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 px-3 pb-3 lg:bottom-0 lg:px-6 lg:pb-5">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-white shadow-card">
        <p className="text-sm">
          <span className="font-display text-lg font-extrabold">{items.length}</span>{' '}
          {items.length === 1 ? 'artikel' : 'artikelen'} in je offerte
          {stuks > 0 && <span className="text-ink-300"> · {stuks} stuks</span>}
        </p>
        <button
          type="button"
          onClick={leegmaken}
          className="text-xs text-ink-300 underline underline-offset-2 hover:text-white"
        >
          Leegmaken
        </button>
        <Link href="/offerte" className="btn-primary ml-auto px-5 py-2 text-sm">
          Bekijk en verstuur
        </Link>
      </div>
    </div>
  );
}
