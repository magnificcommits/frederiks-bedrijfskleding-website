'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FilterContext, FilterOptie, FilterZoekActie } from '@/lib/filterBalk';

/**
 * Zoekbare keuze (typeahead) die zijn opties via een server action ophaalt.
 * Bedoeld voor lijsten die te lang worden voor een <select>: klanten,
 * aanvragers, contactpersonen.
 *
 * - Bij openen wordt de actie al aangeroepen met een lege term. Kan de actie
 *   iets zinnigs laten zien zonder tekst (bijv. alle personen van de gekozen
 *   klant), dan staat dat er meteen. Anders geeft hij [] en zie je de hint.
 * - Daarna ~200 ms na de laatste toetsaanslag opnieuw.
 * - Pijltjes, Enter en Escape werken; klikken buiten het veld sluit het.
 * - Een antwoord dat te laat binnenkomt (je typte al verder) wordt genegeerd.
 */
export default function ZoekKeuze({
  zoek,
  context = {},
  waarde,
  waardeLabel,
  onKies,
  placeholder = 'Typ om te zoeken',
  hint,
  label,
  ariaLabel,
  breedte = 'w-64',
  autoFocus = false,
  wisLabel = 'Keuze wissen',
}: {
  zoek: FilterZoekActie;
  context?: FilterContext;
  /** Huidige keuze (id). Leeg = niets gekozen. */
  waarde: string;
  /** Wat er in het veld staat als er een keuze is. */
  waardeLabel?: string | null;
  onKies: (optie: FilterOptie | null) => void;
  placeholder?: string;
  hint?: string;
  label?: string;
  /** Toegankelijke naam als er geen zichtbaar label aan het veld hangt. */
  ariaLabel?: string;
  breedte?: string;
  autoFocus?: boolean;
  wisLabel?: string;
}) {
  const id = useId();
  const lijstId = `${id}-lijst`;
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState('');
  const [opties, setOpties] = useState<FilterOptie[]>([]);
  const [actief, setActief] = useState(0);
  const [laden, setLaden] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const volgnummer = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const invoer = useRef<HTMLInputElement>(null);
  // Context als string, zodat een nieuw object met dezelfde inhoud geen nieuwe zoekronde start.
  const contextSleutel = JSON.stringify(context);

  function haal(term: string) {
    const nr = ++volgnummer.current;
    setLaden(true);
    zoek(term, JSON.parse(contextSleutel) as FilterContext)
      .then((res) => {
        if (nr !== volgnummer.current) return;
        setOpties(Array.isArray(res) ? res : []);
        setActief(0);
        setGeladen(true);
      })
      .catch(() => {
        if (nr === volgnummer.current) {
          setOpties([]);
          setGeladen(true);
        }
      })
      .finally(() => {
        if (nr === volgnummer.current) setLaden(false);
      });
  }

  function openen() {
    if (open) return;
    setOpen(true);
    haal(tekst);
  }

  function wijzig(t: string) {
    setTekst(t);
    if (!open) setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => haal(t), 200);
  }

  function kies(o: FilterOptie | null) {
    onKies(o);
    setOpen(false);
    setTekst('');
    setGeladen(false);
  }

  // Klik buiten het veld sluit de lijst.
  useEffect(() => {
    if (!open) return;
    const weg = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) {
        setOpen(false);
        setTekst('');
      }
    };
    document.addEventListener('mousedown', weg);
    return () => document.removeEventListener('mousedown', weg);
  }, [open]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const heeftKeuze = Boolean(waarde);
  const toon = open ? tekst : heeftKeuze ? waardeLabel || 'Gekozen' : '';

  return (
    <div ref={wrapper} className={`relative ${/(^|\s)max-w-/.test(breedte) ? '' : 'max-w-full'} ${breedte}`}>
      {label && (
        <label htmlFor={id} className="veld-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={invoer}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={lijstId}
          aria-autocomplete="list"
          aria-label={label ? undefined : ariaLabel ?? placeholder}
          aria-activedescendant={open && opties[actief] ? `${id}-o${actief}` : undefined}
          value={toon}
          placeholder={heeftKeuze ? waardeLabel || placeholder : placeholder}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          onFocus={openen}
          onClick={openen}
          onChange={(e) => wijzig(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) openen();
              else setActief((a) => Math.min(a + 1, Math.max(0, opties.length - 1)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActief((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              if (open && opties[actief]) {
                e.preventDefault();
                kies(opties[actief]);
              }
            } else if (e.key === 'Escape') {
              if (open) {
                e.preventDefault();
                setOpen(false);
                setTekst('');
              }
            }
          }}
          className={`veld ${heeftKeuze ? 'pr-8 font-medium' : 'pr-7'} ${heeftKeuze && !open ? 'border-ink-300' : ''}`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          {laden && open ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" aria-hidden="true" />
          ) : null}
        </span>
        {heeftKeuze && !open && (
          <button
            type="button"
            onClick={() => kies(null)}
            className="absolute inset-y-0 right-1 my-auto flex h-6 w-6 items-center justify-center rounded text-[16px] leading-none text-warm hover:bg-mist hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label={wisLabel}
            title={wisLabel}
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <ul
          id={lijstId}
          role="listbox"
          className="absolute left-0 z-40 mt-1 max-h-72 w-full min-w-[16rem] overflow-y-auto rounded-md border border-line bg-white py-1 text-[13px] shadow-lg"
        >
          {opties.map((o, i) => (
            <li
              key={o.waarde}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === actief}
              onMouseDown={(e) => {
                e.preventDefault();
                kies(o);
              }}
              onMouseEnter={() => setActief(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-2.5 py-1.5 ${i === actief ? 'bg-mist' : ''} ${o.waarde === waarde ? 'font-semibold' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-ink-900">{o.label}</span>
                {o.sub && <span className="block truncate text-[11px] text-warm">{o.sub}</span>}
              </span>
              {o.aantal != null && <span className="chip-tel shrink-0">{o.aantal}</span>}
            </li>
          ))}
          {opties.length === 0 && (
            <li className="px-2.5 py-2 text-[12px] text-warm">
              {laden && !geladen ? 'Zoeken…' : tekst.trim() ? `Niets gevonden voor “${tekst.trim()}”.` : hint ?? 'Typ om te zoeken.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
