'use client';
import { useState } from 'react';
import { useDemo } from './DemoProvider';
import { Balk, TijdChip, euro, knopAccent, knopStil } from './ui';

/** Goedkeuringen: de leidinggevende keurt een aanvraag goed of wijst hem af (lokaal). */
export default function GoedkeuringenDemo() {
  const { data, orders, medewerker, budgetVan, beoordeel, leidinggevendeVan } = useDemo();
  const [laatste, setLaatste] = useState<{ id: string; besluit: 'goedgekeurd' | 'afgewezen' } | null>(null);

  const wachtend = orders.filter((o) => o.goedkeuring === 'wacht');
  const behandeld = orders.filter((o) => o.goedkeuring === 'goedgekeurd' || o.goedkeuring === 'afgewezen');
  const afdelingNaam = (id: string) => data.afdelingen.find((a) => a.id === id)?.naam ?? '';

  function besluit(id: string, b: 'goedgekeurd' | 'afgewezen') {
    beoordeel(id, b);
    setLaatste({ id, besluit: b });
  }

  return (
    <div className="mt-6">
      {laatste && (
        <div
          role="status"
          className={`mb-5 rounded-xl border p-4 text-sm ${laatste.besluit === 'goedgekeurd' ? 'border-green-300 bg-green-50 text-green-800' : 'border-line bg-white text-ink-800'}`}
        >
          {laatste.besluit === 'goedgekeurd'
            ? 'Goedgekeurd. Als klant gaat de bestelling nu meteen door naar Jessi, en de collega ziet de status terug.'
            : 'Afgewezen. De collega ziet dat terug en kan een nieuwe aanvraag doen.'}
        </div>
      )}

      {wachtend.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-warm shadow-soft">
          Er wacht niets meer op je. Plaats in de winkelmand een bestelling boven iemands budget om te zien hoe een nieuwe aanvraag hier binnenkomt.
        </p>
      ) : (
        <div className="space-y-5">
          {wachtend.map((o) => {
            const mw = medewerker(o.medewerkerId);
            const b = mw ? budgetVan(mw.id) : null;
            const leid = leidinggevendeVan(o.medewerkerId);
            return (
              <article key={o.id} className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink-900">Order {o.ordernummer}</p>
                    <p className="mt-0.5 text-sm text-warm">
                      {o.datumLabel}
                      {mw ? ` · voor ${mw.naam} (${mw.functie}, ${afdelingNaam(mw.afdelingId)})` : ''}
                    </p>
                    {o.reden && <p className="mt-1 text-sm text-ink-800">Reden: {o.reden}</p>}
                  </div>
                  <span className="font-display text-xl font-extrabold text-ink-900">{euro(o.bedrag)}</span>
                </div>

                <div className="mt-4 overflow-x-auto border-t border-line pt-4">
                  <table className="w-full min-w-[20rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-warm">
                        <th className="pb-2 pr-4">Artikel</th>
                        <th className="pb-2 pr-4">Maat</th>
                        <th className="pb-2 pr-4 text-right">Aantal</th>
                        <th className="pb-2 text-right">Stukprijs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {o.regels.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-4 text-ink-800">{r.naam}</td>
                          <td className="py-2 pr-4 text-warm">{r.maat ?? '-'}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-ink-900">{r.aantal}x</td>
                          <td className="py-2 text-right text-warm">{euro(r.stukprijs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {b && mw && (
                  <div className="mt-4 rounded-xl bg-mist p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold text-ink-900">Budget {mw.voornaam}</span>
                      <span className="text-warm">
                        {euro(b.verbruikt, true)} verbruikt + {euro(o.bedrag, true)} deze aanvraag, van {euro(b.budget, true)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Balk deel={b.verbruikt + o.bedrag} totaal={b.budget} label={`Budget ${mw.naam} inclusief deze aanvraag`} />
                    </div>
                  </div>
                )}

                <p className="mt-4 text-xs text-warm">
                  Je beoordeelt als {leid ? `leidinggevende (net als ${leid.naam})` : 'leidinggevende'}. In het echte portaal ziet die de aanvraag hier klaarstaan.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => besluit(o.id, 'goedgekeurd')} className={knopAccent}>
                    Goedkeuren
                  </button>
                  <button type="button" onClick={() => besluit(o.id, 'afgewezen')} className={knopStil}>
                    Afwijzen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <TijdChip className="mt-6">goedkeuring door de leidinggevende. Niemand bestelt ongemerkt boven budget, en jij hoeft niet elke bestelling na te lopen.</TijdChip>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="font-display text-xl font-extrabold text-ink-900">Behandeld</h2>
        {behandeld.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Nog niets behandeld.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {behandeld.map((o) => {
              const af = o.goedkeuring === 'afgewezen';
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft">
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900">Order {o.ordernummer}</p>
                    <p className="mt-0.5 text-sm text-warm">
                      {o.datumLabel}
                      {medewerker(o.medewerkerId) ? ` · voor ${medewerker(o.medewerkerId)?.naam}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-extrabold text-ink-900">{euro(o.bedrag)}</span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${af ? 'border-red-300 bg-red-50 text-red-700' : 'border-green-300 bg-green-50 text-green-700'}`}
                    >
                      {af ? 'Afgewezen' : 'Goedgekeurd'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
