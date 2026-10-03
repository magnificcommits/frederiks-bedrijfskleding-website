'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { InrichtingPunt } from '../_delen/inrichting';

/**
 * Compacte checklist bovenaan de klantkaart zolang er bij de klant nog iets
 * ontbreekt (contactpersoon, facturatiecontact, werknemers, assortiment,
 * portaaltoegang). Elk punt linkt naar de plek waar je het regelt.
 *
 * Verdwijnt vanzelf als alles staat, of als Jessi op Verbergen klikt. Dat
 * onthoudt de browser per klant; lukt opslaan niet (privévenster), dan is hij
 * alleen tot het verversen weg.
 */
export default function InrichtingChecklist({
  orgId,
  punten,
  wizardHref,
}: {
  orgId: string;
  punten: InrichtingPunt[];
  wizardHref: string;
}) {
  const sleutel = `fb-inrichting-verborgen:${orgId}`;
  // Pas na het laden in de browser tonen: dan weten we of hij verborgen was en
  // springt hij niet eerst in beeld om daarna te verdwijnen.
  const [geladen, setGeladen] = useState(false);
  const [verborgen, setVerborgen] = useState(false);

  useEffect(() => {
    try {
      setVerborgen(window.localStorage.getItem(sleutel) === '1');
    } catch {
      // Geen opslag beschikbaar: gewoon tonen.
    }
    setGeladen(true);
  }, [sleutel]);

  const open = punten.filter((p) => !p.klaar && !p.optioneel);
  if (!geladen || verborgen || open.length === 0) return null;

  const klaar = punten.filter((p) => p.klaar).length;

  function verberg() {
    setVerborgen(true);
    try {
      window.localStorage.setItem(sleutel, '1');
    } catch {
      // Niet erg: dan komt hij na verversen terug.
    }
  }

  return (
    <section aria-label="Klant inrichten" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-amber-900">
            Klant inrichten: {klaar} van {punten.length} klaar
          </p>
          <p className="text-[13px] text-amber-900">Klik op een punt om het meteen te regelen.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={wizardHref} className="knop-donker">
            Stap voor stap verder
          </Link>
          <button type="button" onClick={verberg} className="knop-tekst text-amber-900">
            Verbergen
          </button>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {punten.map((p) => (
          <li key={p.sleutel}>
            <Link
              href={p.href}
              title={p.uitleg}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] font-semibold ${
                p.klaar
                  ? 'border-green-200 bg-white text-green-800'
                  : 'border-amber-300 bg-white text-ink-900 hover:border-amber-500'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  p.klaar ? 'bg-green-600 text-white' : 'border border-amber-500'
                }`}
              >
                {p.klaar ? '✓' : ''}
              </span>
              {p.label}
              {!p.klaar && p.optioneel && <span className="font-normal text-warm">(optioneel)</span>}
              <span className="sr-only">{p.klaar ? ' (klaar)' : ` (nog te doen: ${p.uitleg})`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
