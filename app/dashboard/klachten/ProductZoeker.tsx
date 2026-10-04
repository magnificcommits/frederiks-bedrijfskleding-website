'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { zoekProductenActie } from './actions';
import type { ProductKeuze } from '@/lib/kms/service';

/**
 * Artikel koppelen aan een vraag of klacht. Eerst de artikelen van de gekozen
 * order (`suggesties`), en anders zoeken in de hele catalogus (server-side, max 8).
 * Schrijft een verborgen veld `product_id`.
 */
export default function ProductZoeker({
  begin,
  suggesties = [],
  label = 'Artikel',
}: {
  begin?: ProductKeuze | null;
  suggesties?: ProductKeuze[];
  label?: string;
}) {
  const id = useId();
  const [gekozen, setGekozen] = useState<ProductKeuze | null>(begin ?? null);
  const [tekst, setTekst] = useState('');
  const [treffers, setTreffers] = useState<ProductKeuze[]>([]);
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volgnummer = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const lijst = tekst.trim().length >= 2 ? treffers : suggesties;

  function zoek(q: string) {
    setTekst(q);
    setOpen(true);
    setActief(0);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setTreffers([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const mijn = ++volgnummer.current;
      const res = await zoekProductenActie(q);
      if (mijn === volgnummer.current) setTreffers(res);
    }, 220);
  }

  function kies(p: ProductKeuze | null) {
    setGekozen(p);
    setTekst('');
    setOpen(false);
  }

  if (gekozen) {
    return (
      <div>
        <span className="veld-label">{label}</span>
        <input type="hidden" name="product_id" value={gekozen.id} />
        <div className="flex items-center gap-2 rounded-md border border-line bg-mist px-3 py-1.5">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-900">
            {gekozen.naam}
            {gekozen.merk && <span className="ml-1.5 font-normal text-warm">{gekozen.merk}</span>}
          </p>
          <button type="button" onClick={() => kies(null)} className="knop-tekst text-[12px]">
            Wissen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-in`} className="veld-label">
        {label}
      </label>
      <input type="hidden" name="product_id" value="" />
      <input
        id={`${id}-in`}
        type="text"
        role="combobox"
        aria-expanded={open && lijst.length > 0}
        aria-controls={`${id}-lijst`}
        aria-autocomplete="list"
        autoComplete="off"
        value={tekst}
        placeholder={suggesties.length ? 'Kies uit de order of zoek een artikel' : 'Zoek op naam, merk of artikelnummer'}
        onChange={(e) => zoek(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActief((a) => Math.min(a + 1, Math.max(0, lijst.length - 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActief((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (lijst[actief]) kies(lijst[actief]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="veld"
      />
      {open && lijst.length > 0 && (
        <ul id={`${id}-lijst`} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-line bg-white py-1 shadow-card">
          {lijst.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={actief === i}
              onMouseDown={(e) => {
                e.preventDefault();
                kies(p);
              }}
              onMouseEnter={() => setActief(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-[13px] ${actief === i ? 'bg-amber-50' : ''}`}
            >
              <span className="truncate font-semibold text-ink-900">{p.naam}</span>
              {p.merk && <span className="shrink-0 text-[12px] text-warm">{p.merk}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
