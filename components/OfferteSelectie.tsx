'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * Offerteselectie: meerdere artikelen verzamelen en er in één keer een offerte
 * voor aanvragen.
 *
 * Tot nu toe kon je vanaf een productpagina één artikel meenemen naar het
 * offerteformulier (via ?product=...). Dat past niet bij hoe dit werkt: een
 * bedrijf dat kleding uitzoekt wil een polo én een broek én een softshell in
 * één voorstel, niet drie losse aanvragen.
 *
 * De keuze staat in sessionStorage en niet in de URL: een lijst met tien
 * artikelnamen maakt een onleesbare, deelbare link die na een dag niet meer
 * klopt. sessionStorage blijft staan tijdens het rondkijken en is weg zodra het
 * tabblad dicht gaat - precies de levensduur die je wilt.
 */
export type SelectieItem = {
  id: string;
  naam: string;
  merk: string | null;
  categorieSlug: string | null;
  slug: string;
  foto: string | null;
};

type Ctx = {
  items: SelectieItem[];
  gekozen: (id: string) => boolean;
  wissel: (item: SelectieItem) => void;
  verwijder: (id: string) => void;
  leegmaken: () => void;
  klaar: boolean;
};

const SLEUTEL = 'fb-offerte-selectie';
const OfferteSelectieContext = createContext<Ctx | null>(null);

export function OfferteSelectieProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SelectieItem[]>([]);
  // `klaar` voorkomt dat de balk kort verkeerd flitst voordat sessionStorage gelezen is.
  const [klaar, setKlaar] = useState(false);

  useEffect(() => {
    try {
      const ruw = window.sessionStorage.getItem(SLEUTEL);
      if (ruw) setItems(JSON.parse(ruw) as SelectieItem[]);
    } catch {
      /* stille val: liever geen selectie dan een stukgelopen pagina */
    }
    setKlaar(true);
  }, []);

  useEffect(() => {
    if (!klaar) return;
    try {
      window.sessionStorage.setItem(SLEUTEL, JSON.stringify(items));
    } catch {
      /* privémodus of vol quotum: dan werkt de selectie alleen deze pagina */
    }
  }, [items, klaar]);

  const wissel = useCallback((item: SelectieItem) => {
    setItems((h) => (h.some((x) => x.id === item.id) ? h.filter((x) => x.id !== item.id) : [...h, item]));
  }, []);
  const verwijder = useCallback((id: string) => setItems((h) => h.filter((x) => x.id !== id)), []);
  const leegmaken = useCallback(() => setItems([]), []);
  const gekozen = useCallback((id: string) => items.some((x) => x.id === id), [items]);

  const waarde = useMemo<Ctx>(
    () => ({ items, gekozen, wissel, verwijder, leegmaken, klaar }),
    [items, gekozen, wissel, verwijder, leegmaken, klaar],
  );

  return <OfferteSelectieContext.Provider value={waarde}>{children}</OfferteSelectieContext.Provider>;
}

/**
 * Buiten de provider (bijvoorbeeld in het dashboard) geeft dit een lege selectie
 * terug in plaats van een fout. Zo kan een component die selecteerbaar is ook
 * gewoon ergens anders gebruikt worden.
 */
export function useOfferteSelectie(): Ctx {
  const ctx = useContext(OfferteSelectieContext);
  return (
    ctx ?? {
      items: [],
      gekozen: () => false,
      wissel: () => {},
      verwijder: () => {},
      leegmaken: () => {},
      klaar: false,
    }
  );
}

/** Vinkje rechtsboven op een productkaart. */
export function SelectieKnop({
  item,
  className = '',
  labels,
}: {
  item: SelectieItem;
  className?: string;
  /** Op een productkaart is kort genoeg; op een detailpagina wil je een hele zin. */
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
      title={aan ? 'Uit je offerte halen' : 'Meenemen in je offerte'}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition ${
        aan
          ? 'border-amber-500 bg-amber-500 text-ink-900'
          : 'border-line bg-white/95 text-ink-700 hover:border-amber-400'
      } ${className}`}
    >
      <span aria-hidden="true">{aan ? '✓' : '+'}</span>
      <span className="sr-only sm:not-sr-only">
        {aan ? (labels?.aan ?? 'Gekozen') : (labels?.uit ?? 'Offerte')}
      </span>
    </button>
  );
}

/** Vaste balk onderin zodra er iets gekozen is. */
export function OfferteBalk() {
  const { items, leegmaken, klaar } = useOfferteSelectie();
  if (!klaar || items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 px-3 pb-3 lg:bottom-0 lg:px-6 lg:pb-5">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-white shadow-card">
        <p className="text-sm">
          <span className="font-display text-lg font-extrabold">{items.length}</span>{' '}
          {items.length === 1 ? 'artikel' : 'artikelen'} in je offerte
        </p>
        <button
          type="button"
          onClick={leegmaken}
          className="text-xs text-ink-300 underline underline-offset-2 hover:text-white"
        >
          Leegmaken
        </button>
        <Link href="/offerte" className="btn-primary ml-auto px-5 py-2 text-sm">
          Offerte aanvragen
        </Link>
      </div>
    </div>
  );
}
