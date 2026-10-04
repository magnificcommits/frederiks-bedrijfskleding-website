'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * Foutscherm voor error.tsx in het dashboard en portaal. Gewone taal, geen
 * stacktrace: wat er gebeurde, dat er niets kwijt is, en twee wegen verder
 * (opnieuw proberen of terug). De technische code staat klein onderaan, voor
 * als Tim ernaar vraagt.
 */
export default function FoutStaat({
  error,
  reset,
  titel = 'Dit scherm kon niet worden geladen',
  tekst = 'Er ging iets mis bij het ophalen van de gegevens. Er is niets verloren gegaan. Probeer het opnieuw; lukt het dan nog niet, wacht dan een minuut of ga terug.',
  opnieuwLabel = 'Opnieuw proberen',
  terugHref = '/dashboard',
  terugLabel = 'Naar het overzicht',
  codeLabel = 'Foutcode',
  offlineTekst = 'Je lijkt geen internetverbinding te hebben. Controleer de wifi of mobiele data en probeer het dan opnieuw.',
  breedte = 'container-app',
  element: Tag = 'main',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  titel?: string;
  tekst?: string;
  opnieuwLabel?: string;
  terugHref?: string;
  terugLabel?: string;
  codeLabel?: string;
  offlineTekst?: string;
  breedte?: string;
  /** 'div' als de layout eromheen al een <main> heeft. */
  element?: 'main' | 'div';
}) {
  const kop = useRef<HTMLHeadingElement>(null);
  const [bezig, setBezig] = useState(false);
  // Offline is de meest voorkomende oorzaak op een tablet in het magazijn.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error(error);
    setOffline(navigator.onLine === false);
    kop.current?.focus();
  }, [error]);

  return (
    <Tag className={`${breedte} py-10`}>
      <div role="alert" className="panel mx-auto max-w-lg p-6">
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3.5L17.5 16.5h-15z" />
            <path d="M10 8.5v3.5" />
            <circle cx="10" cy="14.2" r="0.6" fill="currentColor" />
          </svg>
        </span>
        <h1 ref={kop} tabIndex={-1} className="mt-3 font-display text-lg font-bold text-ink-900 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
          {titel}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-warm">
          {offline ? offlineTekst : tekst}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBezig(true);
              reset();
              setTimeout(() => setBezig(false), 1500);
            }}
            disabled={bezig}
            className="knop-primair knop-groot"
          >
            {opnieuwLabel}
          </button>
          <Link href={terugHref} className="knop-stil knop-groot">
            {terugLabel}
          </Link>
        </div>
        {error.digest && (
          <p className="mt-5 text-[11px] text-warm">
            {codeLabel}: <code className="select-all">{error.digest}</code>
          </p>
        )}
      </div>
    </Tag>
  );
}
