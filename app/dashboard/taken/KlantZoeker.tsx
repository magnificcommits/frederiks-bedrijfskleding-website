'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KlantKeuze } from '@/lib/kms/taken';

/**
 * Zoekbalk voor de klant in het taakvenster (in plaats van een lange lijst met
 * 180 klanten). Typ een paar letters van de naam of plaats en kies met de muis
 * of met pijltjes + Enter. Geen klant? Dan geldt wat je typte als onderwerp.
 */

export type KlantWaarde = { klantId: string | null; tekst: string };

function normaal(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export default function KlantZoeker({
  klanten,
  waarde,
  onChange,
  autoFocus,
  label = 'Klant',
}: {
  klanten: KlantKeuze[];
  waarde: KlantWaarde;
  onChange: (w: KlantWaarde, klant: KlantKeuze | null) => void;
  autoFocus?: boolean;
  label?: string;
}) {
  const id = useId();
  const lijstId = `${id}-lijst`;
  const invoerRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const gekozen = waarde.klantId ? klanten.find((k) => k.id === waarde.klantId) ?? null : null;

  useEffect(() => {
    if (autoFocus) setTimeout(() => invoerRef.current?.focus(), 30);
  }, [autoFocus]);

  const treffers = useMemo(() => {
    const q = normaal(waarde.tekst);
    if (!q) return klanten.slice(0, 8);
    const woorden = q.split(/\s+/);
    const scoor = (k: KlantKeuze) => {
      const naam = normaal(k.naam);
      const alles = `${naam} ${normaal(k.plaats)}`;
      if (!woorden.every((w) => alles.includes(w))) return -1;
      if (naam.startsWith(q)) return 3;
      if (naam.split(/\s+/).some((d) => d.startsWith(woorden[0]))) return 2;
      return 1;
    };
    return klanten
      .map((k) => ({ k, s: scoor(k) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.k.naam.localeCompare(b.k.naam, 'nl'))
      .slice(0, 8)
      .map((x) => x.k);
  }, [klanten, waarde.tekst]);

  const tekstOptie = waarde.tekst.trim() && !treffers.some((k) => normaal(k.naam) === normaal(waarde.tekst));
  const aantalOpties = treffers.length + (tekstOptie ? 1 : 0);

  const kies = (k: KlantKeuze | null) => {
    if (k) onChange({ klantId: k.id, tekst: k.naam }, k);
    else onChange({ klantId: null, tekst: waarde.tekst.trim() }, null);
    setOpen(false);
  };

  if (gekozen) {
    return (
      <div>
        <span className="veld-label">{label}</span>
        <div className="flex items-center gap-2 rounded-md border border-line bg-mist px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink-900">{gekozen.naam}</p>
            {(gekozen.plaats || gekozen.adres) && <p className="truncate text-[12px] text-warm">{gekozen.adres ?? gekozen.plaats}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({ klantId: null, tekst: '' }, null);
              setTimeout(() => invoerRef.current?.focus(), 30);
            }}
            className="knop-tekst text-[13px]"
          >
            Andere klant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-invoer`} className="veld-label">
        {label}
      </label>
      <input
        ref={invoerRef}
        id={`${id}-invoer`}
        type="text"
        role="combobox"
        aria-expanded={open && aantalOpties > 0}
        aria-controls={lijstId}
        aria-autocomplete="list"
        aria-activedescendant={open && aantalOpties > 0 ? `${id}-optie-${actief}` : undefined}
        autoComplete="off"
        value={waarde.tekst}
        placeholder="Zoek op naam of plaats, of typ een onderwerp"
        onChange={(e) => {
          onChange({ klantId: null, tekst: e.target.value }, null);
          setOpen(true);
          setActief(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActief((a) => Math.min(a + 1, Math.max(0, aantalOpties - 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActief((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            // Enter kiest een klant, maar slaat het venster nooit op.
            e.preventDefault();
            e.stopPropagation();
            if (open && aantalOpties > 0) kies(actief < treffers.length ? treffers[actief] : null);
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="veld py-2.5 text-[15px]"
      />
      {open && aantalOpties > 0 && (
        <ul
          id={lijstId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-line bg-white py-1 shadow-card"
        >
          {treffers.map((k, i) => (
            <li
              key={k.id}
              id={`${id}-optie-${i}`}
              role="option"
              aria-selected={actief === i}
              onMouseDown={(e) => {
                e.preventDefault();
                kies(k);
              }}
              onMouseEnter={() => setActief(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-[14px] ${actief === i ? 'bg-amber-50' : ''}`}
            >
              <span className="truncate font-semibold text-ink-900">{k.naam}</span>
              {k.plaats && <span className="shrink-0 text-[12px] text-warm">{k.plaats}</span>}
            </li>
          ))}
          {tekstOptie && (
            <li
              id={`${id}-optie-${treffers.length}`}
              role="option"
              aria-selected={actief === treffers.length}
              onMouseDown={(e) => {
                e.preventDefault();
                kies(null);
              }}
              onMouseEnter={() => setActief(treffers.length)}
              className={`cursor-pointer border-t border-line px-3 py-2 text-[13px] text-warm ${actief === treffers.length ? 'bg-amber-50' : ''}`}
            >
              Geen klant: gebruik <span className="font-semibold text-ink-900">&ldquo;{waarde.tekst.trim()}&rdquo;</span> als onderwerp
            </li>
          )}
        </ul>
      )}
      {!waarde.tekst && <p className="veld-hint">Laat leeg als de taak niet bij een klant hoort.</p>}
    </div>
  );
}
