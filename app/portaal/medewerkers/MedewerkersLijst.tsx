'use client';

import { useMemo, useState, type ReactNode } from 'react';

export type MedewerkerRij = {
  id: string;
  naam: string;
  functie: string;
  loginLabel: string;
  heeftLogin: boolean;
  budgetRestantLabel: string;
  detail: ReactNode;
};

const veld =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/**
 * Compacte, doorzoekbare lijst van medewerkers (SaaS-stijl). Elke rij is één regel
 * hoog en klapt als accordion open om de server-gerenderde detail-JSX te tonen.
 * De detail-node bevat de bestaande server-action-formulieren ongewijzigd.
 */
export default function MedewerkersLijst({ rijen }: { rijen: MedewerkerRij[] }) {
  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const term = zoek.trim().toLowerCase();
  const zichtbaar = useMemo(() => {
    if (!term) return rijen;
    return rijen.filter(
      (r) => r.naam.toLowerCase().includes(term) || r.functie.toLowerCase().includes(term),
    );
  }, [rijen, term]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totaal = rijen.length;
  const teller =
    term && zichtbaar.length !== totaal
      ? `${zichtbaar.length} van ${totaal} medewerkers`
      : `${totaal} ${totaal === 1 ? 'medewerker' : 'medewerkers'}`;

  if (totaal === 0) {
    return <p className="text-sm text-warm">Nog geen medewerkers toegevoegd. Voeg er rechts een toe.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam of functie&hellip;"
          aria-label="Zoek medewerkers"
          className={`${veld} max-w-xs`}
        />
        <p className="text-xs font-semibold uppercase tracking-wide text-warm">{teller}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        {zichtbaar.length === 0 ? (
          <p className="p-6 text-sm text-warm">Geen medewerkers gevonden voor &lsquo;{zoek}&rsquo;.</p>
        ) : (
          <ul className="divide-y divide-line">
            {zichtbaar.map((r) => {
              const aan = open.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-expanded={aan}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-mist ${
                      aan ? 'bg-mist' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink-900">{r.naam}</span>
                      <span className="block truncate text-xs text-warm">{r.functie || 'Geen functie'}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      {r.heeftLogin ? (
                        <span className="inline-block rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-800">
                          {r.loginLabel}
                        </span>
                      ) : (
                        <span className="inline-block rounded-full border border-line bg-cream px-2.5 py-0.5 text-[11px] font-semibold text-warm">
                          {r.loginLabel}
                        </span>
                      )}
                      {r.budgetRestantLabel && (
                        <span className="text-xs font-medium text-warm">{r.budgetRestantLabel}</span>
                      )}
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 text-warm transition-transform ${aan ? 'rotate-180' : ''}`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {aan && <div className="border-t border-line bg-mist/40 px-4 py-5">{r.detail}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
