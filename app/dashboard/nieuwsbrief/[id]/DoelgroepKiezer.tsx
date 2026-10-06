'use client';

import { useEffect, useRef, useState } from 'react';
import type { BrancheTelling, Doelgroep, DoelgroepSoort } from '@/lib/kms/nieuwsbrief';
import { telOntvangers } from './actions';

const SOORTEN: { soort: DoelgroepSoort; label: string; uitleg: string }[] = [
  { soort: 'alle', label: 'Iedereen in de lijst', uitleg: 'Alle klanten met een algemeen e-mailadres en alle aanmeldingen via de site.' },
  { soort: 'actieve-klanten', label: 'Alleen actieve klanten', uitleg: 'Klanten die op actief staan. Losse aanmeldingen gaan niet mee.' },
  { soort: 'inschrijvingen', label: 'Alleen aanmeldingen via de site', uitleg: 'Mensen die zich zelf hebben aangemeld via het formulier.' },
  { soort: 'branches', label: 'Alleen bepaalde branches', uitleg: 'Kies hieronder een of meer branches.' },
];

/**
 * Keuze van de doelgroep, met live het aantal ontvangers. Hoort binnen het
 * formulier met slaVerzendgegevensOp (velden doelgroep_soort en doelgroep_branches).
 */
export default function DoelgroepKiezer({
  begin,
  branches,
  uit = false,
}: {
  begin: Doelgroep;
  branches: BrancheTelling[];
  uit?: boolean;
}) {
  const [soort, setSoort] = useState<DoelgroepSoort>(begin.soort);
  const [gekozen, setGekozen] = useState<string[]>(begin.branches);
  const [aantal, setAantal] = useState<number | null>(null);
  const [bezig, setBezig] = useState(false);
  const volgnummer = useRef(0);

  useEffect(() => {
    const nr = ++volgnummer.current;
    setBezig(true);
    const t = setTimeout(async () => {
      try {
        const n = await telOntvangers({ soort, branches: gekozen });
        if (nr === volgnummer.current) setAantal(n);
      } finally {
        if (nr === volgnummer.current) setBezig(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [soort, gekozen]);

  function wissel(branche: string) {
    setGekozen((huidig) => (huidig.includes(branche) ? huidig.filter((b) => b !== branche) : [...huidig, branche]));
  }

  return (
    <fieldset disabled={uit} className="disabled:opacity-60">
      <legend className="veld-label">Wie krijgt deze nieuwsbrief?</legend>
      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOORTEN.map((s) => (
          <label
            key={s.soort}
            className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${
              soort === s.soort ? 'border-amber-500 bg-amber-50' : 'border-line bg-white hover:border-ink-300'
            }`}
          >
            <input
              type="radio"
              name="doelgroep_soort"
              value={s.soort}
              checked={soort === s.soort}
              onChange={() => setSoort(s.soort)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block text-[15px] font-semibold text-ink-900">{s.label}</span>
              <span className="block text-[13px] text-warm">{s.uitleg}</span>
            </span>
          </label>
        ))}
      </div>

      {soort === 'branches' && (
        <div className="mt-3">
          {branches.length === 0 ? (
            <p className="text-[13px] text-warm">Er zijn nog geen branches ingevuld op de klantkaarten.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const aan = gekozen.includes(b.branche);
                return (
                  <label key={b.branche} className={`chip cursor-pointer ${aan ? 'chip-aan' : ''}`}>
                    <input
                      type="checkbox"
                      name="doelgroep_branches"
                      value={b.branche}
                      checked={aan}
                      onChange={() => wissel(b.branche)}
                      className="sr-only"
                    />
                    {b.branche}
                    <span className="chip-tel">{b.aantal}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 rounded-lg border border-line bg-mist px-4 py-2.5 text-[14px] text-ink-900" aria-live="polite">
        {bezig && aantal === null ? (
          'Ontvangers tellen...'
        ) : (
          <>
            <span className="font-bold tabular-nums">{aantal ?? 0}</span> {aantal === 1 ? 'ontvanger' : 'ontvangers'} met deze keuze
            {bezig && <span className="text-warm"> (bijwerken...)</span>}
            <span className="block text-[12px] text-warm">
              Afgemelde adressen en dubbele adressen tellen niet mee. Vergeet niet op Opslaan te klikken.
            </span>
          </>
        )}
      </p>
    </fieldset>
  );
}
