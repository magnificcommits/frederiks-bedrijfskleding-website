'use client';

import { useId, useMemo, useRef, useState } from 'react';

/**
 * Klantzoeker voor Service (klachten, retouren, instellingen). Kopie van het
 * patroon in app/dashboard/taken/KlantZoeker.tsx, maar zonder "gebruik als
 * onderwerp": hier moet het altijd een bestaande klant zijn. Schrijft een
 * verborgen veld `name` met het organisatie-id, zodat een gewone server action werkt.
 */

export type KlantOptie = { id: string; naam: string; plaats: string | null; adres?: string | null };

function normaal(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export default function KlantZoeker({
  klanten,
  name = 'organisatie_id',
  label = 'Klant',
  verplicht = false,
  beginId = null,
  hint,
  onKies,
}: {
  klanten: KlantOptie[];
  name?: string;
  label?: string;
  verplicht?: boolean;
  beginId?: string | null;
  hint?: string;
  onKies?: (klant: KlantOptie | null) => void;
}) {
  const id = useId();
  const lijstId = `${id}-lijst`;
  const invoerRef = useRef<HTMLInputElement>(null);
  const [tekst, setTekst] = useState('');
  const [gekozenId, setGekozenId] = useState<string | null>(beginId);
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const gekozen = gekozenId ? klanten.find((k) => k.id === gekozenId) ?? null : null;

  const treffers = useMemo(() => {
    const q = normaal(tekst);
    if (!q) return klanten.slice(0, 8);
    const woorden = q.split(/\s+/);
    const scoor = (k: KlantOptie) => {
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
  }, [klanten, tekst]);

  const kies = (k: KlantOptie | null) => {
    setGekozenId(k?.id ?? null);
    setTekst('');
    setOpen(false);
    onKies?.(k);
  };

  if (gekozen) {
    return (
      <div>
        <span className="veld-label">{label}</span>
        <input type="hidden" name={name} value={gekozen.id} />
        <div className="flex items-center gap-2 rounded-md border border-line bg-mist px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-ink-900">{gekozen.naam}</p>
            {(gekozen.plaats || gekozen.adres) && <p className="truncate text-[12px] text-warm">{gekozen.adres ?? gekozen.plaats}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              kies(null);
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
      {/* Leeg verborgen veld, zodat de server ziet dat er niets gekozen is. */}
      <input type="hidden" name={name} value="" />
      <input
        ref={invoerRef}
        id={`${id}-invoer`}
        type="text"
        role="combobox"
        aria-expanded={open && treffers.length > 0}
        aria-controls={lijstId}
        aria-autocomplete="list"
        aria-activedescendant={open && treffers.length > 0 ? `${id}-optie-${actief}` : undefined}
        aria-required={verplicht || undefined}
        autoComplete="off"
        value={tekst}
        placeholder="Zoek op naam of plaats"
        onChange={(e) => {
          setTekst(e.target.value);
          setOpen(true);
          setActief(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActief((a) => Math.min(a + 1, Math.max(0, treffers.length - 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActief((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            // Enter kiest een klant, maar verstuurt het formulier nooit.
            e.preventDefault();
            e.stopPropagation();
            if (open && treffers[actief]) kies(treffers[actief]);
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="veld py-2"
      />
      {open && treffers.length > 0 && (
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
        </ul>
      )}
      {open && tekst.trim() && treffers.length === 0 && (
        <p className="veld-hint">Geen klant gevonden met &ldquo;{tekst.trim()}&rdquo;.</p>
      )}
      {hint && !tekst && <p className="veld-hint">{hint}</p>}
    </div>
  );
}
