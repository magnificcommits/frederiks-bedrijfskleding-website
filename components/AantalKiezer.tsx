'use client';

import { MAX_PER_MAAT, schoonAantal } from '@/lib/offerteMand';

/**
 * Aantal kiezen met een min- en een plusknop, en typen mag ook. Gebruikt op de
 * productpagina (per maat) en in het offertemandje. Knoppen van 36 px, zodat ze
 * op een telefoon goed te raken zijn.
 */
export function AantalKiezer({
  waarde,
  onChange,
  label,
  kop,
  uit = false,
  klein = false,
  titel,
}: {
  waarde: number;
  onChange: (n: number) => void;
  /** Voor schermlezers, bv. "Aantal in maat M". */
  label: string;
  /** Zichtbare kop boven de knoppen, bv. de maat. */
  kop?: string;
  uit?: boolean;
  klein?: boolean;
  titel?: string;
}) {
  const knop = `flex ${klein ? 'h-8 w-8' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-md text-lg font-bold leading-none transition disabled:cursor-not-allowed disabled:opacity-30`;
  return (
    <div
      className={`flex flex-col items-center rounded-lg border px-1 pb-1.5 pt-1 ${uit ? 'border-line bg-mist opacity-50' : waarde > 0 ? 'border-amber-400 bg-amber-50/60' : 'border-line bg-white focus-within:border-amber-400'}`}
      title={titel}
    >
      {kop && <span className={`${klein ? 'text-[11px]' : 'text-xs'} font-bold text-ink-800`}>{kop}</span>}
      <div className="mt-1 flex w-full items-center justify-between gap-0.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, waarde - 1))}
          disabled={uit || waarde <= 0}
          aria-label={`${label}: één minder`}
          className={`${knop} text-ink-700 hover:bg-mist`}
        >
          −
        </button>
        <input
          inputMode="numeric"
          disabled={uit}
          value={waarde ? String(waarde) : ''}
          onChange={(e) => onChange(schoonAantal(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          placeholder="0"
          aria-label={label}
          className={`w-full min-w-0 border-0 bg-transparent p-0 text-center ${klein ? 'text-sm' : 'text-base'} font-semibold tabular-nums text-ink-900 placeholder:font-normal placeholder:text-ink-300 focus:outline-none focus:ring-0`}
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_PER_MAAT, waarde + 1))}
          disabled={uit || waarde >= MAX_PER_MAAT}
          aria-label={`${label}: één meer`}
          className={`${knop} bg-ink-900 text-white hover:bg-ink-700`}
        >
          +
        </button>
      </div>
    </div>
  );
}
