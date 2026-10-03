'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { slaAfdelingenOpActie } from './actions';

export type BestaandeAfdeling = { id: string; naam: string; werknemers: number; artikelen: number };

/**
 * Stap 3 van de wizard: afdelingen als chips. Typ een naam en druk op Enter,
 * of tik een suggestie aan. Leeg laten mag: dan is de hele klant één groep.
 */
export default function StapAfdelingen({
  klantId,
  bestaande,
  suggesties,
  knoppen,
}: {
  klantId: string;
  bestaande: BestaandeAfdeling[];
  suggesties: string[];
  knoppen: ReactNode;
}) {
  const [nieuw, setNieuw] = useState<string[]>([]);
  const [weg, setWeg] = useState<string[]>([]);
  const [invoer, setInvoer] = useState('');

  const bekend = new Set(
    [...bestaande.filter((a) => !weg.includes(a.id)).map((a) => a.naam), ...nieuw].map((n) => n.trim().toLowerCase()),
  );

  function voegToe(tekst: string) {
    // Meerdere tegelijk mag, gescheiden door komma's.
    const namen = tekst
      .split(',')
      .map((n) => n.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const erbij: string[] = [];
    for (const n of namen) {
      const sleutel = n.toLowerCase();
      if (bekend.has(sleutel) || erbij.some((e) => e.toLowerCase() === sleutel)) continue;
      // Stond hij op weghalen, dan gewoon terugzetten.
      const terug = bestaande.find((a) => a.naam.trim().toLowerCase() === sleutel);
      if (terug) {
        setWeg((h) => h.filter((id) => id !== terug.id));
        continue;
      }
      erbij.push(n);
    }
    if (erbij.length > 0) setNieuw((h) => [...h, ...erbij]);
  }

  function opToets(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (invoer.trim()) voegToe(invoer);
      setInvoer('');
    } else if (e.key === 'Backspace' && !invoer && nieuw.length > 0) {
      setNieuw((h) => h.slice(0, -1));
    }
  }

  const openSuggesties = suggesties.filter((s) => !bekend.has(s.toLowerCase()));
  const zichtbaarBestaand = bestaande.filter((a) => !weg.includes(a.id));
  const totaal = zichtbaarBestaand.length + nieuw.length;

  return (
    <form action={slaAfdelingenOpActie} className="flex flex-col gap-4">
      <input type="hidden" name="klantId" value={klantId} />
      <input type="hidden" name="nieuw" value={JSON.stringify(nieuw)} />
      <input type="hidden" name="weg" value={JSON.stringify(weg)} />

      <div className="panel p-4">
        <label className="veld-label" htmlFor="afd-invoer">
          Afdeling toevoegen
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-white px-2 py-2 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
          {zichtbaarBestaand.map((a) => {
            const vast = a.werknemers > 0 || a.artikelen > 0;
            return (
              <span
                key={a.id}
                className="chip chip-aan"
                title={vast ? 'Hier hangen al werknemers of artikelen aan; verwijderen kan op de klantkaart.' : undefined}
              >
                {a.naam}
                {vast ? null : (
                  <button
                    type="button"
                    onClick={() => setWeg((h) => [...h, a.id])}
                    aria-label={`${a.naam} weghalen`}
                    className="ml-1"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          {nieuw.map((n) => (
            <span key={n} className="chip chip-aan">
              {n}
              <button
                type="button"
                onClick={() => setNieuw((h) => h.filter((x) => x !== n))}
                aria-label={`${n} weghalen`}
                className="ml-1"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="afd-invoer"
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            onKeyDown={opToets}
            onBlur={() => {
              if (invoer.trim()) voegToe(invoer);
              setInvoer('');
            }}
            placeholder={totaal === 0 ? 'Typ een naam en druk op Enter, bijv. Lassers' : 'Nog een afdeling…'}
            autoFocus
            autoComplete="off"
            className="min-w-[14rem] flex-1 border-0 bg-transparent px-1 py-1 text-[15px] outline-none"
          />
        </div>

        {openSuggesties.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-warm">Veel gebruikt in deze branche</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {openSuggesties.map((s) => (
                <button key={s} type="button" onClick={() => voegToe(s)} className="chip">
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[13px] text-warm">
        Een afdeling is een groep werknemers met eigen kleding, bijvoorbeeld lassers met laskleding en logistiek
        zonder. Geen verschil in kleding? Laat dit leeg: dan is de hele klant één groep en geldt het assortiment voor
        iedereen. Je kunt later altijd afdelingen toevoegen.
      </p>

      {knoppen}
    </form>
  );
}
