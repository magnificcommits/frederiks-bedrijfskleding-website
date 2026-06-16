'use client';
import { useMemo, useState } from 'react';
import { plaatsBestelling } from './actions';
import type { WebshopProduct, WebshopMedewerker } from '@/lib/portaal/webshop';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const effectievePrijs = (verkoopprijs: number | null, meerprijs: number | null) =>
  (Number(verkoopprijs) || 0) + (Number(meerprijs) || 0);

type MandItem = { variantId: string; aantal: number };

type Props = {
  producten: WebshopProduct[];
  budgetActief: boolean;
  resterendBudget: number | null;
  eigenMedewerkerNaam: string | null;
  kiesMedewerker: boolean;
  medewerkers: WebshopMedewerker[];
};

const inputClass =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default function WebshopClient({
  producten,
  budgetActief,
  resterendBudget,
  eigenMedewerkerNaam,
  kiesMedewerker,
  medewerkers,
}: Props) {
  const [mand, setMand] = useState<MandItem[]>([]);
  const [keuze, setKeuze] = useState<Record<string, string>>({});

  const variantIndex = useMemo(() => {
    const map = new Map<string, { product: WebshopProduct; variant: WebshopProduct['varianten'][number] }>();
    for (const p of producten) for (const v of p.varianten) map.set(v.id, { product: p, variant: v });
    return map;
  }, [producten]);

  const voegToe = (variantId: string) => {
    if (!variantId) return;
    setMand((m) => {
      const bestaat = m.find((x) => x.variantId === variantId);
      if (bestaat) return m.map((x) => (x.variantId === variantId ? { ...x, aantal: x.aantal + 1 } : x));
      return [...m, { variantId, aantal: 1 }];
    });
  };

  const wijzigAantal = (variantId: string, aantal: number) => {
    if (aantal <= 0) {
      setMand((m) => m.filter((x) => x.variantId !== variantId));
      return;
    }
    setMand((m) => m.map((x) => (x.variantId === variantId ? { ...x, aantal } : x)));
  };

  const totaal = mand.reduce((sum, item) => {
    const match = variantIndex.get(item.variantId);
    if (!match) return sum;
    return sum + item.aantal * effectievePrijs(match.variant.verkoopprijs, match.variant.meerprijs);
  }, 0);

  const overBudget = budgetActief && resterendBudget != null && totaal > resterendBudget;
  const leeg = mand.length === 0;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="font-display text-xl font-extrabold text-ink-900">Producten</h2>
        {producten.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Er staan nog geen producten in jullie assortiment.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {producten.map((p) => {
              const gekozenVariant = keuze[p.id] ?? p.varianten[0]?.id ?? '';
              return (
                <div key={p.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                  <p className="font-bold text-ink-900">{p.naam}</p>
                  <p className="mt-1 text-sm text-warm">
                    {[p.merk, p.categorie].filter(Boolean).join(' · ') || 'Geen details'}
                  </p>
                  {p.omschrijving && <p className="mt-2 text-sm text-warm">{p.omschrijving}</p>}
                  {p.varianten.length === 0 ? (
                    <p className="mt-4 text-sm text-warm">Geen leverbare varianten.</p>
                  ) : (
                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-warm">Maat en kleur</label>
                      <select
                        value={gekozenVariant}
                        onChange={(e) => setKeuze((k) => ({ ...k, [p.id]: e.target.value }))}
                        className={inputClass}
                      >
                        {p.varianten.map((v) => (
                          <option key={v.id} value={v.id}>
                            {[v.maat, v.kleur].filter(Boolean).join(' · ') || 'Standaard'} —{' '}
                            {euro(effectievePrijs(v.verkoopprijs, v.meerprijs))}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => voegToe(gekozenVariant)}
                        className="btn-primary mt-3 w-full"
                      >
                        In winkelwagen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Winkelwagen</h2>

          {budgetActief && resterendBudget != null && (
            <p className="mt-2 text-sm text-warm">
              Resterend budget: <span className="font-semibold text-ink-900">{euro(resterendBudget)}</span>
            </p>
          )}

          {leeg ? (
            <p className="mt-4 text-sm text-warm">Je winkelwagen is nog leeg.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {mand.map((item) => {
                const match = variantIndex.get(item.variantId);
                if (!match) return null;
                const prijs = effectievePrijs(match.variant.verkoopprijs, match.variant.meerprijs);
                return (
                  <li key={item.variantId} className="border-b border-line pb-3">
                    <p className="text-sm font-semibold text-ink-900">{match.product.naam}</p>
                    <p className="text-xs text-warm">
                      {[match.variant.maat, match.variant.kleur].filter(Boolean).join(' · ') || 'Standaard'} · {euro(prijs)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={item.aantal}
                        onChange={(e) => wijzigAantal(item.variantId, parseInt(e.target.value || '0', 10))}
                        className="w-20 rounded-md border border-line px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      <button
                        type="button"
                        onClick={() => wijzigAantal(item.variantId, 0)}
                        className="text-xs font-semibold text-warm hover:text-ink-800"
                      >
                        Verwijder
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-warm">Totaal</span>
            <span className="font-display font-extrabold text-ink-900">{euro(totaal)}</span>
          </div>

          {overBudget && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink-800">
              Het totaal is hoger dan het resterende budget. Pas de winkelwagen aan om te kunnen bestellen.
            </div>
          )}

          <form action={plaatsBestelling} className="mt-4">
            <input type="hidden" name="mand" value={JSON.stringify(mand)} />

            {kiesMedewerker ? (
              <div className="mb-3">
                <label htmlFor="medewerker_id" className="block text-xs font-semibold text-warm">
                  Bestellen voor medewerker
                </label>
                <select id="medewerker_id" name="medewerker_id" defaultValue="" className={inputClass}>
                  <option value="">Geen specifieke medewerker</option>
                  {medewerkers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              eigenMedewerkerNaam && (
                <p className="mb-3 text-xs text-warm">Bestelling op naam van {eigenMedewerkerNaam}.</p>
              )
            )}

            <div className="mb-3">
              <label htmlFor="notitie" className="block text-xs font-semibold text-warm">
                Opmerking (optioneel)
              </label>
              <textarea id="notitie" name="notitie" rows={2} className={inputClass} />
            </div>

            <button type="submit" disabled={leeg || overBudget} className="btn-primary w-full disabled:opacity-50">
              Bestelling plaatsen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
