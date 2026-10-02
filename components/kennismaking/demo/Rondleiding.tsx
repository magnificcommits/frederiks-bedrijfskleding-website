'use client';
import { useEffect, useRef, useState } from 'react';
import { useDemo } from './DemoProvider';

/**
 * Korte rondleiding van vier stappen bij het eerste bezoek. Wegklikken onthoudt
 * de keuze voor deze sessie. Via "Rondleiding" in de navigatie start hij opnieuw.
 */
export default function Rondleiding() {
  const { data, geladen, rondleidingGezien, setRondleidingGezien } = useDemo();
  const [stap, setStap] = useState(0);
  const knopRef = useRef<HTMLButtonElement | null>(null);
  const zichtbaar = geladen && !rondleidingGezien;

  const stappen = [
    {
      titel: `Dit is het portaal van ${data.bedrijfsnaam}`,
      tekst: 'Zo ziet jullie eigen klantportaal eruit: jullie logo, jullie kleur en alleen de kleding die bij jullie hoort. Alles hier is een voorbeeld, je kunt niets kapotmaken.',
    },
    {
      titel: 'Bestellen zonder maten te zoeken',
      tekst: 'Kies bij Kleding bestellen voor wie je bestelt. De maten van die collega staan al klaar, je drukt alleen nog op In winkelmand.',
    },
    {
      titel: 'Budget en goedkeuring per persoon',
      tekst: 'Iedereen heeft een eigen kledingbudget. Gaat een bestelling erboven, dan keurt de leidinggevende hem eerst goed. Kijk bij Beheer, daar wacht er al een.',
    },
    {
      titel: 'Altijd hetzelfde logo',
      tekst: 'Bij Drukproeven zie je jullie logo op de kleding. Eenmaal goedgekeurd komt het bij elke bestelling precies zo terug.',
    },
  ];

  useEffect(() => {
    if (zichtbaar) {
      setStap(0);
      knopRef.current?.focus();
    }
  }, [zichtbaar]);

  useEffect(() => {
    if (!zichtbaar) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setRondleidingGezien(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zichtbaar, setRondleidingGezien]);

  if (!zichtbaar) return null;
  const s = stappen[stap] ?? stappen[0];
  const laatste = stap === stappen.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Rondleiding sluiten"
        className="absolute inset-0 cursor-default bg-ink-900/40"
        onClick={() => setRondleidingGezien(true)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rondleiding-titel"
        className="relative w-full max-w-md animate-fade-up rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Rondleiding · stap {stap + 1} van {stappen.length}
          </p>
          <button
            type="button"
            onClick={() => setRondleidingGezien(true)}
            className="min-h-[40px] text-xs font-semibold text-warm hover:text-ink-900"
          >
            Overslaan
          </button>
        </div>
        <h2 id="rondleiding-titel" className="mt-2 font-display text-xl font-extrabold text-ink-900">
          {s?.titel}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{s?.tekst}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {stappen.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i === stap ? 'bg-ink-900' : 'bg-ink-200'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {stap > 0 && (
              <button
                type="button"
                onClick={() => setStap((v) => v - 1)}
                className="min-h-[44px] rounded-md border border-line px-4 text-sm font-semibold text-ink-800 hover:bg-mist"
              >
                Terug
              </button>
            )}
            <button
              ref={knopRef}
              type="button"
              onClick={() => (laatste ? setRondleidingGezien(true) : setStap((v) => v + 1))}
              className="min-h-[44px] rounded-md bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-800"
            >
              {laatste ? 'Zelf rondkijken' : 'Volgende'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
