'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Filtervelden voor de productenlijst. Elk veld zet zijn eigen parameter in de
 * URL en laat de rest staan (zoekterm, sortering, andere filters); alleen de
 * paginering gaat terug naar 1. Zo is elke selectie te delen en te bookmarken.
 */

const MELDINGEN = ['ok', 'fout', 'pagina'];

function useZetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const [bezig, start] = useTransition();
  const zet = (wijzig: Record<string, string | null>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(wijzig)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    for (const k of MELDINGEN) p.delete(k);
    // Oude parameter van het losse "zonder foto"-knopje: het nieuwe fotofilter neemt het over.
    if ('foto' in wijzig) p.delete('zonderfoto');
    const qs = p.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { zet, bezig };
}

export type Keuze = { value: string; label: string; groep?: string };

export function FilterKeuze({
  param,
  label,
  waarde,
  opties,
  leeg,
  breedte = 'w-44',
}: {
  param: string;
  label: string;
  waarde: string;
  opties: Keuze[];
  leeg: string;
  breedte?: string;
}) {
  const { zet, bezig } = useZetParams();
  // Lokaal bijhouden, anders springt de keuze terug tot de nieuwe pagina binnen is.
  const [gekozen, setGekozen] = useState(waarde);
  useEffect(() => setGekozen(waarde), [waarde]);
  const groepen = [...new Set(opties.map((o) => o.groep ?? ''))];
  const id = `filter-${param}`;
  return (
    <div className={breedte}>
      <label htmlFor={id} className="veld-label">{label}</label>
      <select
        id={id}
        value={gekozen}
        onChange={(e) => {
          setGekozen(e.target.value);
          zet({ [param]: e.target.value || null });
        }}
        className={`veld ${gekozen ? 'border-ink-400 font-semibold' : ''}`}
        aria-busy={bezig || undefined}
      >
        <option value="">{leeg}</option>
        {groepen.length > 1
          ? groepen.map((g) => (
              <optgroup key={g} label={g || 'Overig'}>
                {opties
                  .filter((o) => (o.groep ?? '') === g)
                  .map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
              </optgroup>
            ))
          : opties.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
      </select>
    </div>
  );
}

export function PrijsBereik({ min, max }: { min: string; max: string }) {
  const { zet } = useZetParams();
  const [van, setVan] = useState(min);
  const [tot, setTot] = useState(max);
  useEffect(() => setVan(min), [min]);
  useEffect(() => setTot(max), [max]);
  const toepassen = () => {
    const schoon = (v: string) => v.replace(',', '.').replace(/[^0-9.]/g, '') || null;
    if (schoon(van) !== (min || null) || schoon(tot) !== (max || null)) zet({ prijs_min: schoon(van), prijs_max: schoon(tot) });
  };
  return (
    <fieldset className="w-48">
      <legend className="veld-label">Vanafprijs (excl. btw)</legend>
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Prijs vanaf"
          inputMode="decimal"
          value={van}
          onChange={(e) => setVan(e.target.value)}
          onBlur={toepassen}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toepassen())}
          placeholder="van"
          className="veld"
        />
        <span className="text-warm">tot</span>
        <input
          aria-label="Prijs tot"
          inputMode="decimal"
          value={tot}
          onChange={(e) => setTot(e.target.value)}
          onBlur={toepassen}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toepassen())}
          placeholder="tot"
          className="veld"
        />
      </div>
    </fieldset>
  );
}

export function FilterVinkje({ param, label, aan }: { param: string; label: string; aan: boolean }) {
  const { zet } = useZetParams();
  const [vink, setVink] = useState(aan);
  useEffect(() => setVink(aan), [aan]);
  return (
    <label className="flex items-center gap-2 self-end pb-1.5 text-[13px] text-ink-700">
      <input
        type="checkbox"
        checked={vink}
        onChange={(e) => {
          setVink(e.target.checked);
          zet({ [param]: e.target.checked ? '1' : null });
        }}
      />
      {label}
    </label>
  );
}
