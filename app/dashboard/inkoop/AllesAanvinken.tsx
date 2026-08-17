'use client';

import { useRef } from 'react';

/**
 * Twee knoppen die alle regel-checkboxes binnen hetzelfde formulier aan- of
 * uitzetten. Bij Houweling staan er zo tien merken onder elkaar; die stuk voor
 * stuk aanvinken is werk dat niemand wil doen.
 *
 * Plaats dit binnen het <form> van één inkooppartij. Het zoekt zijn eigen
 * formulier op, dus het weet niets van de regels zelf.
 */
export default function AllesAanvinken() {
  const houder = useRef<HTMLDivElement>(null);

  function zetAlles(aan: boolean) {
    const formulier = houder.current?.closest('form');
    if (!formulier) return;
    const vakjes = formulier.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="regelId"]');
    vakjes.forEach((vakje) => {
      vakje.checked = aan;
    });
  }

  return (
    <div ref={houder} className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => zetAlles(true)} className="knop-stil">
        Alles aanvinken
      </button>
      <button type="button" onClick={() => zetAlles(false)} className="knop-stil">
        Selectie wissen
      </button>
    </div>
  );
}
