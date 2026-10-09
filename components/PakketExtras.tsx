'use client';

import { useEffect, useState } from 'react';
import { AantalKiezer } from '@/components/AantalKiezer';
import { volledigeNaam } from '@/lib/offerteMand';

export type ExtraKeuze = { id: string; naam: string; foto: string | null; aantal: number };
export type ExtraWaarde = { on: boolean; aantal: string; keuzes?: ExtraKeuze[] };
type Artikel = { id: string; naam: string; merk: string | null; foto: string | null };

/**
 * Schoenen of accessoires bij het pakket. Aangevinkt zie je de echte artikelen
 * uit het assortiment; kies er een of meer met een aantal per model. Kies je
 * niets, dan geef je alleen een aantal op en adviseert Jessi bij het passen.
 * Bij schoenen kun je filteren op veiligheidsklasse.
 */
export function PakketExtra({
  id,
  label,
  uitleg,
  type,
  waarde,
  standaardAantal,
  onChange,
}: {
  id: string;
  label: string;
  uitleg: string;
  type: 'schoenen' | 'accessoires';
  waarde: ExtraWaarde | undefined;
  standaardAantal: number;
  onChange: (w: ExtraWaarde) => void;
}) {
  const aan = !!waarde?.on;
  const keuzes = waarde?.keuzes ?? [];
  const [artikelen, setArtikelen] = useState<Artikel[] | null>(null);
  const [klasse, setKlasse] = useState<string | null>(null);

  useEffect(() => {
    if (!aan || artikelen) return;
    let weg = false;
    fetch(`/api/pakket/artikelen?type=${type}&n=30`)
      .then((r) => r.json() as Promise<{ artikelen?: Artikel[] }>)
      .then((d) => { if (!weg) setArtikelen(d.artikelen ?? []); })
      .catch(() => { if (!weg) setArtikelen([]); });
    return () => { weg = true; };
  }, [aan, artikelen, type]);

  const klassen = type === 'schoenen'
    ? ['S1P', 'S3', 'S7', 'ESD'].filter((k) => artikelen?.some((a) => a.naam.toUpperCase().includes(k)))
    : [];
  const zichtbaar = (artikelen ?? []).filter((a) => !klasse || a.naam.toUpperCase().includes(klasse));

  function wissel(a: Artikel) {
    const al = keuzes.some((k) => k.id === a.id);
    const nieuw = al
      ? keuzes.filter((k) => k.id !== a.id)
      : [...keuzes, { id: a.id, naam: volledigeNaam(a.merk, a.naam), foto: a.foto, aantal: standaardAantal }];
    onChange({ on: true, aantal: waarde?.aantal ?? '', keuzes: nieuw });
  }

  return (
    <div className={`rounded-lg border-2 ${aan ? 'border-amber-500 bg-amber-50/40' : 'border-line'}`}>
      <label className="flex cursor-pointer items-center gap-2 p-2.5 text-sm font-semibold text-ink-900">
        <input
          type="checkbox"
          checked={aan}
          onChange={() => onChange({ on: !aan, aantal: waarde?.aantal ?? '', keuzes })}
          className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300"
        />
        {label}
        {aan && keuzes.length > 0 && <span className="ml-auto text-xs font-normal text-warm">{keuzes.length} {keuzes.length === 1 ? 'model' : 'modellen'}</span>}
      </label>
      {aan && (
        <div className="border-t border-line/70 px-2.5 pb-3 pt-2">
          <p className="text-xs text-warm">{uitleg}</p>
          {klassen.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[null, ...klassen].map((k) => (
                <button
                  key={k ?? 'alle'}
                  type="button"
                  onClick={() => setKlasse(k)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${klasse === k ? 'border-amber-500 bg-amber-50 text-ink-900' : 'border-line bg-white text-ink-700'}`}
                >
                  {k ?? 'Alle'}
                </button>
              ))}
            </div>
          )}
          {artikelen === null ? (
            <p className="mt-2 text-xs text-warm">Even zoeken…</p>
          ) : (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {zichtbaar.map((a) => {
                const gekozen = keuzes.some((k) => k.id === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => wissel(a)}
                    aria-pressed={gekozen}
                    className={`w-28 shrink-0 rounded-lg border-2 bg-white p-1.5 text-left transition ${gekozen ? 'border-amber-500' : 'border-line hover:border-ink-300'}`}
                  >
                    <span className="block h-16 w-full overflow-hidden rounded bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {a.foto && <img src={a.foto} alt="" className="h-full w-full object-contain" loading="lazy" />}
                    </span>
                    {a.merk && <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-amber-700">{a.merk}</span>}
                    <span className="block text-[11px] font-semibold leading-tight text-ink-900 line-clamp-2">{a.naam}</span>
                  </button>
                );
              })}
            </div>
          )}
          {keuzes.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {keuzes.map((k) => (
                <li key={k.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 grow truncate font-semibold text-ink-900">{k.naam}</span>
                  <div className="w-32 shrink-0">
                    <AantalKiezer
                      klein
                      label={`Aantal ${k.naam}`}
                      waarde={k.aantal}
                      onChange={(n) => onChange({ on: true, aantal: waarde?.aantal ?? '', keuzes: keuzes.map((x) => (x.id === k.id ? { ...x, aantal: n } : x)) })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 flex items-center gap-3 text-xs text-warm">
              <span className="grow">Geen voorkeur? Geef het aantal op, dan adviseert Jessi bij het passen.</span>
              <div className="w-32 shrink-0">
                <AantalKiezer
                  klein
                  label={`Aantal ${label.toLowerCase()}`}
                  waarde={Number(waarde?.aantal) || 0}
                  onChange={(n) => onChange({ on: true, aantal: n ? String(n) : '', keuzes })}
                />
              </div>
            </div>
          )}
          <span className="sr-only" id={`extra-${id}`} />
        </div>
      )}
    </div>
  );
}

/** Omschrijving per regel, voor de samenvatting, de PDF en de aanvraag. */
export function extraRegels(label: string, w: ExtraWaarde | undefined): { product_id: string | null; naam: string; aantal: number }[] {
  if (!w?.on) return [];
  if (w.keuzes?.length) return w.keuzes.map((k) => ({ product_id: k.id, naam: k.naam, aantal: Math.max(1, k.aantal || 1) }));
  return [{ product_id: null, naam: `${label} (advies bij het passen)`, aantal: Math.max(1, parseInt(w.aantal || '1', 10) || 1) }];
}
