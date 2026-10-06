'use client';
import { useMemo, useState } from 'react';

export type RekenArtikel = { id: string; naam: string; prijs: number; standaard: number };

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euroPrecies = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

/**
 * "Wat kost dat voor jullie team?" Schuif voor de teamgrootte plus per artikel
 * het aantal stuks per persoon. Rekent met de echte vanafprijzen ex btw.
 */
export default function TeamRekenhulp({
  artikelen,
  min,
  max,
  start,
}: {
  artikelen: RekenArtikel[];
  min: number;
  max: number;
  start: number;
}) {
  const [team, setTeam] = useState(start);
  const [aantallen, setAantallen] = useState<Record<string, number>>(
    () => Object.fromEntries(artikelen.map((a) => [a.id, a.standaard])),
  );

  const perPersoon = useMemo(
    () => artikelen.reduce((som, a) => som + (aantallen[a.id] ?? 0) * a.prijs, 0),
    [artikelen, aantallen],
  );
  const totaal = perPersoon * team;

  const zet = (id: string, n: number) => setAantallen((oud) => ({ ...oud, [id]: Math.max(0, Math.min(5, n)) }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <label htmlFor="team" className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink-900">Hoeveel mensen lopen erin?</span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-ink-900">{team}</span>
        </label>
        <input
          id="team"
          type="range"
          min={min}
          max={max}
          step={1}
          value={team}
          onChange={(e) => setTeam(Number(e.target.value))}
          className="mt-3 h-2 w-full cursor-pointer accent-amber-500"
        />
        <div className="mt-1 flex justify-between text-xs text-warm"><span>{min}</span><span>{max}</span></div>

        <p className="mt-6 text-sm font-semibold text-ink-900">Per medewerker</p>
        <ul className="mt-2 divide-y divide-line">
          {artikelen.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-900">{a.naam}</p>
                <p className="text-xs text-warm">vanaf {euroPrecies.format(a.prijs)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Aantal ${a.naam} per persoon`}>
                <button type="button" onClick={() => zet(a.id, (aantallen[a.id] ?? 0) - 1)} className="h-11 w-11 rounded-md border border-line text-lg font-bold text-ink-800 hover:bg-mist" aria-label="Eén minder">−</button>
                <span className="w-6 text-center font-semibold tabular-nums">{aantallen[a.id] ?? 0}</span>
                <button type="button" onClick={() => zet(a.id, (aantallen[a.id] ?? 0) + 1)} className="h-11 w-11 rounded-md border border-line text-lg font-bold text-ink-800 hover:bg-mist" aria-label="Eén meer">+</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col justify-between rounded-xl bg-ink-900 p-5 text-white sm:p-6" aria-live="polite">
        <div>
          <p className="text-sm text-white/70">Per medewerker</p>
          <p className="font-display text-3xl font-extrabold tabular-nums">{euro.format(perPersoon)}</p>
          <p className="mt-5 text-sm text-white/70">Voor {team} medewerkers</p>
          <p className="font-display text-4xl font-extrabold tabular-nums text-amber-400">{euro.format(totaal)}</p>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-white/70">
          Indicatie op basis van de vanafprijzen, exclusief btw en exclusief logo bedrukken of borduren.
          De echte prijs hangt af van maten, kleuren en aantallen. Die hoor je van mij na de pasdag, zwart op wit.
        </p>
      </div>
    </div>
  );
}
