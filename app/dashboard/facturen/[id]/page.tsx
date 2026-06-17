import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getFactuur } from '@/lib/kms/facturen';
import { voegRegel, werkRegel, verwijderRegel, wijzigStatus } from './actions';
import PrintKnop from './PrintKnop';
import ConfirmSubmit from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Factuur', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verzonden: 'bg-amber-100 text-amber-800',
  betaald: 'bg-green-100 text-green-800',
};

const BEDRIJF = {
  naam: 'Frederiks Bedrijfskleding',
  adres: 'Kruisbergseweg 9',
  postcodePlaats: '7255 AG Hengelo Gld',
};

export default async function FactuurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/facturen" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar facturen</Link>
        </div>
      </main>
    );
  }

  const factuur = await getFactuur(id);
  if (!factuur) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Factuur niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze factuur bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/facturen" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar facturen</Link>
        </div>
      </main>
    );
  }

  const org = factuur.organisatie;
  const excl = Number(factuur.bedrag_excl) || 0;
  const btw = Number(factuur.btw_bedrag) || 0;
  const incl = Number(factuur.bedrag_incl) || 0;

  return (
    <main className="container-x py-12">
      <style>{`@media print { body * { visibility: hidden; } #factuur-print, #factuur-print * { visibility: visible; } #factuur-print { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>

      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Factuur {factuur.factuurnummer || 'concept'}</h1>
          <p className="mt-1 text-sm text-warm">{org?.naam || 'Onbekende klant'} · {fmt(factuur.factuurdatum)}</p>
        </div>
        <div className="flex items-center gap-4">
          <PrintKnop />
          <Link href="/dashboard/facturen" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar facturen</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-3 print:hidden">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Factuurgegevens</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-warm">Factuurnummer</dt><dd className="font-medium text-ink-900">{factuur.factuurnummer || 'concept'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Factuurdatum</dt><dd className="text-ink-900">{fmt(factuur.factuurdatum)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Vervaldatum</dt><dd className="text-ink-900">{fmt(factuur.vervaldatum)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Factuur-e-mail</dt><dd className="text-ink-900">{factuur.factuur_email || '-'}</dd></div>
            {factuur.betaaldatum && <div className="flex justify-between gap-3"><dt className="text-warm">Betaald op</dt><dd className="text-ink-900">{fmt(factuur.betaaldatum)}</dd></div>}
          </dl>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Klant</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-warm">Naam</dt><dd className="font-medium text-ink-900">{org?.naam || '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Adres</dt><dd className="text-right text-ink-900">{org?.adres || '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Postcode/plaats</dt><dd className="text-right text-ink-900">{[org?.postcode, org?.plaats].filter(Boolean).join(' ') || '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Btw-nummer</dt><dd className="text-ink-900">{org?.btw_nummer || '-'}</dd></div>
          </dl>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
          <p className="mt-2"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[factuur.status] ?? 'bg-ink-100 text-ink-600'}`}>{factuur.status}</span></p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={wijzigStatus}>
              <input type="hidden" name="factuurId" value={factuur.id} />
              <input type="hidden" name="status" value="concept" />
              <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Concept</button>
            </form>
            <form action={wijzigStatus}>
              <input type="hidden" name="factuurId" value={factuur.id} />
              <input type="hidden" name="status" value="verzonden" />
              <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Verzonden</button>
            </form>
            <form action={wijzigStatus}>
              <input type="hidden" name="factuurId" value={factuur.id} />
              <input type="hidden" name="status" value="betaald" />
              <button type="submit" className="rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800">Betaald</button>
            </form>
          </div>
          <p className="mt-3 text-xs text-warm">Bij Verzonden wordt de vervaldatum op factuurdatum plus 30 dagen gezet. Bij Betaald wordt de betaaldatum op vandaag gezet.</p>
        </div>
      </section>

      <section className="mt-10 print:hidden">
        <h2 className="font-display text-xl font-bold text-ink-900">Factuurregels</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {factuur.regels.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen regels op deze factuur.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-3 py-3">Omschrijving</th>
                      <th className="px-3 py-3">Aantal</th>
                      <th className="px-3 py-3">Stukprijs</th>
                      <th className="px-3 py-3">Btw %</th>
                      <th className="px-3 py-3">Bedrag</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {factuur.regels.map((r) => (
                      <tr key={r.id} className="border-b border-line align-top">
                        <td colSpan={6} className="px-3 py-3">
                          <form action={werkRegel} className="grid grid-cols-12 items-end gap-2">
                            <input type="hidden" name="factuurId" value={factuur.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <div className="col-span-12 sm:col-span-5">
                              <input name="omschrijving" required defaultValue={r.omschrijving} className={inputCls} />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                              <input name="aantal" inputMode="decimal" defaultValue={String(r.aantal ?? 0)} className={inputCls} />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <input name="stukprijs" inputMode="decimal" defaultValue={String(r.stukprijs ?? 0)} className={inputCls} />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                              <input name="btw_pct" inputMode="decimal" defaultValue={String(r.btw_pct ?? 21)} className={inputCls} />
                            </div>
                            <div className="col-span-2 sm:col-span-2 text-right text-sm font-medium text-ink-900">{euro(Number(r.bedrag) || 0)}</div>
                            <div className="col-span-12 sm:col-span-1 flex gap-2">
                              <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                            </div>
                          </form>
                          <form action={verwijderRegel} className="mt-1">
                            <input type="hidden" name="factuurId" value={factuur.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <ConfirmSubmit message="Deze factuurregel verwijderen?" className="text-xs font-semibold text-warm hover:text-ink-800">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-mist"><td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold text-warm">Subtotaal excl. btw: <span className="text-ink-900">{euro(excl)}</span></td></tr>
                    <tr className="bg-mist"><td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold text-warm">Btw: <span className="text-ink-900">{euro(btw)}</span></td></tr>
                    <tr className="bg-mist"><td colSpan={6} className="px-3 py-2 text-right text-sm font-extrabold text-ink-900">Totaal incl. btw: {euro(incl)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">Regel toevoegen</h3>
            <form action={voegRegel} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="factuurId" value={factuur.id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Omschrijving</label>
                <input name="omschrijving" required placeholder="Bijv. Softshell jas met logo" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">Aantal</label>
                  <input name="aantal" inputMode="decimal" defaultValue="1" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Stukprijs</label>
                  <input name="stukprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Btw %</label>
                <input name="btw_pct" inputMode="decimal" defaultValue="21" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>

      <section id="factuur-print" className="mt-12 rounded-2xl border border-line bg-white p-8 shadow-soft print:mt-0 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-2xl font-extrabold text-ink-900">{BEDRIJF.naam}</p>
            <p className="mt-1 text-sm text-warm">{BEDRIJF.adres}</p>
            <p className="text-sm text-warm">{BEDRIJF.postcodePlaats}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold text-ink-900">Factuur</p>
            <p className="mt-1 text-sm text-warm">Nummer: <span className="font-medium text-ink-900">{factuur.factuurnummer || 'concept'}</span></p>
            <p className="text-sm text-warm">Datum: <span className="text-ink-900">{fmt(factuur.factuurdatum)}</span></p>
            <p className="text-sm text-warm">Vervaldatum: <span className="text-ink-900">{fmt(factuur.vervaldatum)}</span></p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Factuur aan</p>
          <p className="mt-1 font-semibold text-ink-900">{org?.naam || '-'}</p>
          {org?.adres && <p className="text-sm text-warm">{org.adres}</p>}
          {(org?.postcode || org?.plaats) && <p className="text-sm text-warm">{[org?.postcode, org?.plaats].filter(Boolean).join(' ')}</p>}
          {org?.btw_nummer && <p className="mt-1 text-sm text-warm">Btw-nummer: {org.btw_nummer}</p>}
          {org?.klantnummer && <p className="text-sm text-warm">Klantnummer: {org.klantnummer}</p>}
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
            <tr>
              <th className="py-2 pr-3">Omschrijving</th>
              <th className="py-2 px-3 text-right">Aantal</th>
              <th className="py-2 px-3 text-right">Stukprijs</th>
              <th className="py-2 px-3 text-right">Btw %</th>
              <th className="py-2 pl-3 text-right">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {factuur.regels.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-2 pr-3 text-ink-900">{r.omschrijving}</td>
                <td className="py-2 px-3 text-right text-warm">{r.aantal}</td>
                <td className="py-2 px-3 text-right text-warm">{euro(Number(r.stukprijs) || 0)}</td>
                <td className="py-2 px-3 text-right text-warm">{Number(r.btw_pct) || 0}%</td>
                <td className="py-2 pl-3 text-right font-medium text-ink-900">{euro(Number(r.bedrag) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-warm">Subtotaal excl. btw</span><span className="text-ink-900">{euro(excl)}</span></div>
          <div className="flex justify-between"><span className="text-warm">Btw</span><span className="text-ink-900">{euro(btw)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 font-extrabold text-ink-900"><span>Totaal incl. btw</span><span>{euro(incl)}</span></div>
        </div>

        {factuur.toegepaste_prijsafspraken && (
          <p className="mt-6 whitespace-pre-wrap rounded-md bg-mist px-3 py-2 text-xs text-warm">{factuur.toegepaste_prijsafspraken}</p>
        )}
        {factuur.factuur_email && <p className="mt-6 text-xs text-warm">Vragen over deze factuur? Mail naar {factuur.factuur_email}.</p>}
      </section>
    </main>
  );
}
