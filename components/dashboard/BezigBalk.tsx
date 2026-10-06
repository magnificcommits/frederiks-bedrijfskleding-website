'use client';

import { useEffect, useState } from 'react';

/**
 * Laat in het hele dashboard zien dat er gewerkt wordt.
 *
 * Luistert mee met fetch: elke server-actie (opslaan, toevoegen, verwijderen)
 * en elke paginawissel telt als "bezig". Duurt het langer dan 250 ms, dan
 * verschijnt bovenin een bewegende balk; bij opslaan ook rechtsonder
 * "Bezig met opslaan…". Zo zie je altijd dat je klik is aangekomen, ook bij
 * formulieren die zelf geen laadstatus hebben. Prefetches tellen niet mee.
 */
type Soort = 'opslaan' | 'laden';

let geinstalleerd = false;
const luisteraars = new Set<(n: { opslaan: number; laden: number }) => void>();
const teller = { opslaan: 0, laden: 0 };

function kop(headers: HeadersInit | undefined, naam: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(naam);
  if (Array.isArray(headers)) {
    const rij = headers.find(([k]) => k.toLowerCase() === naam.toLowerCase());
    return rij ? rij[1] : null;
  }
  const rec = headers as Record<string, string>;
  const sleutel = Object.keys(rec).find((k) => k.toLowerCase() === naam.toLowerCase());
  return sleutel ? rec[sleutel] : null;
}

// Tijdstip van de laatste klik, Enter of formulierverzending. Een server-actie die
// vlak daarna start is "opslaan"; een actie die vanzelf start (bijv. de catalogus
// ophalen bij het laden van een pagina) is gewoon "laden": alleen de balk, geen
// "Bezig met opslaan…".
let laatsteInteractie = 0;

function soortVan(input: RequestInfo | URL, init?: RequestInit): Soort | null {
  const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  if (kop(headers, 'Next-Action')) return Date.now() - laatsteInteractie < 1500 ? 'opslaan' : 'laden';
  if (kop(headers, 'Next-Router-Prefetch')) return null;
  if (kop(headers, 'RSC')) return 'laden';
  return null;
}

function meld() {
  for (const l of luisteraars) l({ ...teller });
}

function installeer() {
  if (geinstalleerd || typeof window === 'undefined') return;
  geinstalleerd = true;
  const markeer = () => {
    laatsteInteractie = Date.now();
  };
  window.addEventListener('pointerdown', markeer, true);
  window.addEventListener('submit', markeer, true);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') markeer();
    },
    true,
  );
  const origineel = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const soort = soortVan(input, init);
    if (!soort) return origineel(input, init);
    teller[soort] += 1;
    meld();
    try {
      return await origineel(input, init);
    } finally {
      teller[soort] = Math.max(0, teller[soort] - 1);
      meld();
    }
  };
}

export default function BezigBalk() {
  const [stand, setStand] = useState({ opslaan: 0, laden: 0 });
  const [zichtbaar, setZichtbaar] = useState(false);

  useEffect(() => {
    installeer();
    luisteraars.add(setStand);
    return () => {
      luisteraars.delete(setStand);
    };
  }, []);

  const bezig = stand.opslaan + stand.laden > 0;
  useEffect(() => {
    if (!bezig) {
      setZichtbaar(false);
      return;
    }
    const t = setTimeout(() => setZichtbaar(true), 250);
    return () => clearTimeout(t);
  }, [bezig]);

  useEffect(() => {
    document.documentElement.classList.toggle('fb-bezig', zichtbaar);
  }, [zichtbaar]);

  if (!zichtbaar) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-amber-100" aria-hidden="true">
        <div className="fb-bezig-streep h-full w-1/3 bg-amber-500" />
      </div>
      {stand.opslaan > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 max-md:bottom-20 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[13px] font-semibold text-white shadow-soft"
        >
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
          Bezig met opslaan…
        </div>
      )}
      <style>{`
        @keyframes fbBezigStreep { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .fb-bezig-streep { animation: fbBezigStreep 1.1s ease-in-out infinite; }
        html.fb-bezig, html.fb-bezig * { cursor: progress !important; }
        @media (prefers-reduced-motion: reduce) { .fb-bezig-streep { animation: none; width: 100%; opacity: .6; } }
      `}</style>
    </>
  );
}
