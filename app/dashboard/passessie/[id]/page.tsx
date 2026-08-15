import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getPassessie, listRegels, listMedewerkers, listCatalogus } from '@/lib/kms/passessies';
import PasSessieFormulier from './PasSessieFormulier';
import { verwijderRegel, rondAf, heropen, maakOrder } from '../actions';

export const metadata: Metadata = { title: 'Passessie', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const euro = (n: number | null) =>
  n === null ? '-' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

export default async function PassessieDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const { ok, fout } = await searchParams;

  const sessie = await getPassessie(id);
  if (!sessie) redirect('/dashboard/passessie?fout=onbekend');

  const [regels, medewerkers, catalogus] = await Promise.all([
    listRegels(id),
    listMedewerkers(sessie.organisatie_id),
    listCatalogus(),
  ]);

  const naamVan = new Map(medewerkers.map((m) => [m.id, m.naam]));
  const perPersoon = new Map<string, typeof regels>();
  for (const r of regels) {
    const sleutel = r.medewerker_id ? naamVan.get(r.medewerker_id) ?? 'Onbekend' : r.medewerker_naam ?? 'Onbekend';
    const bestaand = perPersoon.get(sleutel);
    if (bestaand) bestaand.push(r);
    else perPersoon.set(sleutel, [r]);
  }
  const totaal = regels.reduce((t, r) => t + (r.stukprijs ?? 0) * r.aantal, 0);
  const gesloten = sessie.status !== 'open';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="dash-h1">{sessie.organisatie_naam}</h1>
          <p className="mt-1 text-sm text-warm">
            Passessie {new Date(sessie.datum).toLocaleDateString('nl-NL')}
            {sessie.locatie ? ` - ${sessie.locatie}` : ''}
            {sessie.notitie ? ` - ${sessie.notitie}` : ''}
          </p>
        </div>
        <Link href="/dashboard/passessie" className="text-sm font-semibold text-warm hover:text-ink-800">
          Alle passessies
        </Link>
      </div>

      {ok === 'afgerond' && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Sessie afgerond. Je kunt er nu een order van maken.
        </p>
      )}
      {fout === 'leeg' && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Er staan nog geen regels in deze sessie.
        </p>
      )}
      {sessie.order_id && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Omgezet naar een order.{' '}
          <Link href={`/dashboard/orders/${sessie.order_id}`} className="underline">
            Order openen
          </Link>
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <PasSessieFormulier
          passessieId={id}
          medewerkers={medewerkers}
          catalogus={catalogus}
          gesloten={gesloten}
        />

        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold text-ink-900">Vastgelegd</h2>
              <span className="text-sm text-warm">
                {regels.length} {regels.length === 1 ? 'regel' : 'regels'}
              </span>
            </div>

            {regels.length === 0 ? (
              <p className="mt-3 text-sm text-warm">Nog niets vastgelegd.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {[...perPersoon.entries()].map(([persoon, lijst]) => (
                  <div key={persoon}>
                    <p className="text-sm font-bold text-ink-900">{persoon}</p>
                    <ul className="mt-2 space-y-2">
                      {lijst.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-mist p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink-900">{r.item_naam}</p>
                            <p className="text-xs text-warm">
                              {[r.kleur, r.maat && `maat ${r.maat}`, r.lengte && `lengte ${r.lengte}`, `${r.aantal}x`]
                                .filter(Boolean)
                                .join(' - ')}
                            </p>
                            {r.opmerking && <p className="mt-0.5 text-xs italic text-warm">{r.opmerking}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs font-semibold text-ink-800">
                              {euro(r.stukprijs !== null ? r.stukprijs * r.aantal : null)}
                            </span>
                            {!gesloten && (
                              <form action={verwijderRegel}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="passessie_id" value={id} />
                                <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                                  Weg
                                </button>
                              </form>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="border-t border-line pt-3 text-right text-sm">
                  Totaal <span className="font-bold text-ink-900">{euro(totaal)}</span>
                </p>
              </div>
            )}
          </div>

          <div className="panel p-4">
            {sessie.status === 'open' && (
              <form action={rondAf}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink-900 hover:border-amber-300"
                >
                  Sessie afronden
                </button>
              </form>
            )}
            {sessie.status === 'afgerond' && (
              <div className="space-y-3">
                <form action={maakOrder}>
                  <input type="hidden" name="id" value={id} />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-ink-900 hover:bg-amber-400"
                  >
                    Order maken van deze sessie
                  </button>
                </form>
                <form action={heropen}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="w-full text-sm font-semibold text-warm hover:text-ink-800">
                    Toch nog iets toevoegen
                  </button>
                </form>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
