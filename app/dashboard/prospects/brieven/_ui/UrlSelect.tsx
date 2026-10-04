'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Keuzelijst die direct filtert: de parameter gaat in de URL, de andere filters
 * (zoekterm, branche) blijven staan. Geen Filter-knop nodig.
 */
export default function UrlSelect({
  param,
  waarde,
  opties,
  label,
  leegLabel,
  breedte = 'w-auto',
  vast,
}: {
  param: string;
  waarde: string;
  opties: { value: string; label: string }[];
  label: string;
  /** Tekst voor de lege keuze; weglaten = geen lege keuze. */
  leegLabel?: string;
  breedte?: string;
  vast?: Record<string, string>;
}) {
  const router = useRouter();
  const pad = usePathname();
  const [bezig, start] = useTransition();
  const id = `f-${param}`;
  // Lokaal bijhouden: anders springt de keuze terug tot de server klaar is.
  const [lokaal, setLokaal] = useState(waarde);
  useEffect(() => setLokaal(waarde), [waarde]);
  return (
    <div className={breedte}>
      <label htmlFor={id} className="veld-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={lokaal}
          onChange={(e) => {
            setLokaal(e.target.value);
            const p = new URLSearchParams(window.location.search);
            if (e.target.value) p.set(param, e.target.value);
            else p.delete(param);
            for (const k of ['ok', 'fout', 'melding', 'pagina']) p.delete(k);
            for (const [k, v] of Object.entries(vast ?? {})) p.set(k, v);
            const qs = p.toString();
            start(() => router.replace(qs ? `${pad}?${qs}` : pad, { scroll: false }));
          }}
          className={`veld pr-8 ${bezig ? 'opacity-70' : ''}`}
        >
          {leegLabel !== undefined && <option value="">{leegLabel}</option>}
          {opties.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
