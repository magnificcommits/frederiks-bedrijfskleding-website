'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

/** Vriendelijke melding na "Bestelling plaatsen": dit is een voorbeeld, zo gaat het straks echt. */
export default function VoorbeeldModal({
  open,
  onSluit,
  pasdagHref,
  bestellingenHref,
  wachtOpGoedkeuring,
}: {
  open: boolean;
  onSluit: () => void;
  pasdagHref: string;
  bestellingenHref: string;
  wachtOpGoedkeuring: boolean;
}) {
  const sluitRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    sluitRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onSluit();
    }
    document.addEventListener('keydown', onKey);
    const vorige = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = vorige;
    };
  }, [open, onSluit]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button type="button" aria-label="Sluiten" className="absolute inset-0 cursor-default bg-ink-900/50" onClick={onSluit} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voorbeeld-titel"
        className="relative w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-card"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="voorbeeld-titel" className="mt-4 font-display text-xl font-extrabold text-ink-900">
          Dit is een voorbeeld.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Als klant gaat deze bestelling direct naar Jessi en zie je de status hier terug.
          {wachtOpGoedkeuring
            ? ' Deze ging boven het budget, dus hij staat nu eerst klaar bij Goedkeuringen.'
            : ' Kijk maar bij Bestellingen: hij staat er al tussen.'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Benieuwd hoe de kleding zit? Op een pasdag komt Jessi met paspakketten bij jullie langs. Iedereen past, de maten gaan zo het portaal in.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href={pasdagHref} className="btn-primary flex-1 justify-center">
            Plan een gratis pasdag
          </Link>
          <Link
            href={bestellingenHref}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink-800 hover:bg-mist"
          >
            Bekijk de status
          </Link>
        </div>
        <button
          ref={sluitRef}
          type="button"
          onClick={onSluit}
          className="mt-3 min-h-[40px] w-full text-sm font-semibold text-warm hover:text-ink-900"
        >
          Verder rondkijken
        </button>
      </div>
    </div>
  );
}
