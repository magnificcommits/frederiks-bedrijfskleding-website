import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import {
  getMijnToegang,
  getMedewerkerDetail,
  listVestigingen,
  listProductenVoorMaten,
  getVoorkeursmaten,
} from '@/lib/portaal/team';
import PortaalNav from '../../PortaalNav';
import { zetBudgetInstellingenAction, zetVoorkeursmaatAction, verwijderVoorkeursmaatAction } from './actions';

export const metadata: Metadata = { title: 'Instellingen medewerker', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const veld =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const label = 'block text-sm font-semibold text-ink-900';

const meldingen: Record<string, { soort: 'ok' | 'fout'; tekst: string }> = {
  budget: { soort: 'ok', tekst: 'De budgetinstellingen zijn opgeslagen.' },
  maat: { soort: 'ok', tekst: 'De voorkeursmaat is opgeslagen.' },
  maat_weg: { soort: 'ok', tekst: 'De voorkeursmaat is verwijderd.' },
  opslaan: { soort: 'fout', tekst: 'Er ging iets mis bij het opslaan. Probeer het opnieuw.' },
};

export default async function MedewerkerInstellingen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const toegang = await getMijnToegang();
  if (toegang.rol !== 'beheerder') redirect('/portaal/medewerkers');

  const { id } = await params;
  const medewerker = await getMedewerkerDetail(id);
  if (!medewerker) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Medewerker niet gevonden</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/team" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">Deze medewerker bestaat niet of valt buiten je bedrijf.</p>
          <Link href="/portaal/medewerkers" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            Terug naar medewerkers
          </Link>
        </div>
      </main>
    );
  }

  const [vestigingen, producten, voorkeursmaten] = await Promise.all([
    listVestigingen(),
    listProductenVoorMaten(),
    getVoorkeursmaten(id),
  ]);
  const maatPerProduct = new Map(voorkeursmaten.map((v) => [v.productId, v]));

  const sp = await searchParams;
  const melding = sp?.ok ? meldingen[sp.ok] : sp?.fout ? meldingen[sp.fout] : null;
  const isPunten = medewerker.budgetType === 'punten';
  const eenheid = isPunten ? 'punten' : 'euro';

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{medewerker.naam}</h1>
          <p className="mt-1 text-sm text-warm">
            {[medewerker.functie, medewerker.email].filter(Boolean).join(' · ') || 'Geen contactgegevens'}
          </p>
        </div>
        <Link href="/portaal/medewerkers" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar medewerkers
        </Link>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/team" />

      {melding && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            melding.soort === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-amber-300 bg-amber-50 text-ink-800'
          }`}
        >
          {melding.tekst}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Budgetinstellingen */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-extrabold text-ink-900">Budgetinstellingen</h2>
          <p className="mt-1 text-sm text-warm">
            Bepaal hoe het budget van deze medewerker werkt: in euro of in punten, met een startbudget en eventueel
            een periodieke aanvulling.
          </p>
          <form action={zetBudgetInstellingenAction} className="mt-5 space-y-4">
            <input type="hidden" name="medewerker_id" value={medewerker.id} />

            <div>
              <label className={label}>Budgetsoort</label>
              <select name="budget_type" defaultValue={medewerker.budgetType} className={veld}>
                <option value="euro">Euro</option>
                <option value="punten">Punten</option>
              </select>
              <p className="mt-1 text-xs text-warm">
                Bij punten reken je in stuks of credits in plaats van een bedrag.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Startbudget ({eenheid})</label>
                <input
                  name="startbudget"
                  defaultValue={medewerker.startbudget ?? ''}
                  inputMode="decimal"
                  placeholder="bijv. 250"
                  className={veld}
                />
              </div>
              <div>
                <label className={label}>Huidig budget ({eenheid})</label>
                <input
                  name="budget"
                  defaultValue={medewerker.budget ?? ''}
                  inputMode="decimal"
                  placeholder="bijv. 250"
                  className={veld}
                />
                <p className="mt-1 text-xs text-warm">Het saldo dat nu beschikbaar is.</p>
              </div>
            </div>

            <div>
              <label className={label}>Productbudget (aantal stuks, optioneel)</label>
              <input
                name="productbudget"
                defaultValue={medewerker.productbudget ?? ''}
                inputMode="numeric"
                placeholder="bijv. 5"
                className={veld}
              />
              <p className="mt-1 text-xs text-warm">Maximaal aantal artikelen dat de medewerker mag bestellen.</p>
            </div>

            <label className="flex items-start gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                name="buiten_budget_toegestaan"
                defaultChecked={medewerker.buitenBudgetToegestaan}
                className="mt-0.5 h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200"
              />
              <span>Bestellen boven het budget toestaan (met goedkeuring)</span>
            </label>

            <div className="border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink-900">Periodiek budget</p>
              <p className="mt-0.5 text-xs text-warm">Vul het budget automatisch aan per periode.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Aanvulling ({eenheid})</label>
                  <input
                    name="periodiek_budget"
                    defaultValue={medewerker.periodiekBudget ?? ''}
                    inputMode="decimal"
                    placeholder="bijv. 100"
                    className={veld}
                  />
                </div>
                <div>
                  <label className={label}>Periode</label>
                  <select name="budget_periode" defaultValue={medewerker.budgetPeriode} className={veld}>
                    <option value="geen">Geen aanvulling</option>
                    <option value="maand">Per maand</option>
                    <option value="kwartaal">Per kwartaal</option>
                    <option value="jaar">Per jaar</option>
                  </select>
                </div>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  name="behoud_restbudget"
                  defaultChecked={medewerker.behoudRestbudget}
                  className="mt-0.5 h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200"
                />
                <span>Restbudget meenemen naar de volgende periode</span>
              </label>
            </div>

            <div className="border-t border-line pt-4">
              <label className={label}>Vestiging</label>
              <select name="vestiging_id" defaultValue={medewerker.vestigingId ?? ''} className={veld}>
                <option value="">Geen vestiging</option>
                {vestigingen.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.naam}
                  </option>
                ))}
              </select>
              {vestigingen.length === 0 && (
                <p className="mt-1 text-xs text-warm">Nog geen vestigingen vastgelegd voor dit bedrijf.</p>
              )}
            </div>

            <button className="btn-primary w-full justify-center">Budgetinstellingen opslaan</button>
          </form>
        </section>

        {/* Voorkeursmaten */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-extrabold text-ink-900">Voorkeursmaten</h2>
          <p className="mt-1 text-sm text-warm">
            Leg per product de vaste maat van deze medewerker vast. Bij het bestellen wordt die maat dan al voorgesteld.
          </p>

          {producten.length === 0 ? (
            <p className="mt-5 text-sm text-warm">
              Nog geen producten met maten beschikbaar. Voeg eerst producten en varianten toe.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {producten.map((p) => {
                const huidig = maatPerProduct.get(p.id);
                return (
                  <form
                    key={p.id}
                    action={zetVoorkeursmaatAction}
                    className="rounded-xl border border-line bg-cream/40 p-4"
                  >
                    <input type="hidden" name="medewerker_id" value={medewerker.id} />
                    <input type="hidden" name="product_id" value={p.id} />
                    <p className="font-semibold text-ink-900">{p.naam}</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="min-w-[8rem]">
                        <label className="block text-xs font-semibold text-warm">Maat</label>
                        <select
                          name="voorkeursmaat"
                          defaultValue={huidig?.voorkeursmaat ?? ''}
                          className="mt-1 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="">Geen voorkeur</option>
                          {p.maten.map((maat) => (
                            <option key={maat} value={maat}>
                              {maat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 py-2 text-sm text-ink-800">
                        <input
                          type="checkbox"
                          name="plus_minus_toegestaan"
                          defaultChecked={huidig?.plusMinusToegestaan ?? false}
                          className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200"
                        />
                        <span>1 maat groter of kleiner toegestaan</span>
                      </label>
                      <button className="rounded-md border border-line px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
                        Opslaan
                      </button>
                    </div>
                    {p.maten.length === 0 && (
                      <p className="mt-2 text-xs text-warm">Voor dit product zijn nog geen maten vastgelegd.</p>
                    )}
                    {huidig && (
                      <div className="mt-2">
                        <button
                          formAction={verwijderVoorkeursmaatAction}
                          name="maat_id"
                          value={huidig.id}
                          className="text-xs font-semibold text-warm hover:text-amber-700"
                        >
                          Voorkeur verwijderen
                        </button>
                      </div>
                    )}
                  </form>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
