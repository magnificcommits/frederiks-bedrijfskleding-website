import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getOfferte, offerteTotalen, OFFERTE_STATUSSEN, getKlantProductOpties } from '@/lib/kms/offertes';
import { listOrganisaties } from '@/lib/portaalAdmin';
import { formatEuro, formatDatum } from '@/lib/format';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import {
  werkOfferteActie,
  wijzigStatusActie,
  verwijderOfferteActie,
  werkRegelActie,
  verwijderRegelActie,
} from './actions';
import RegelToevoegen from './RegelToevoegen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offerte', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verstuurd: 'bg-amber-100 text-amber-800',
  geaccepteerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-red-100 text-red-800',
};

function dateInputWaarde(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

export default async function OfferteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const { ok } = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/offertes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </main>
    );
  }

  const [offerte, organisaties] = await Promise.all([getOfferte(id), listOrganisaties()]);
  if (!offerte) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Offerte niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze offerte bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/offertes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </main>
    );
  }

  const { subtotaal, btw, totaal } = offerteTotalen(offerte.regels, offerte.btw_pct);
  const opties = await getKlantProductOpties(offerte.organisatie_id);
  const okTekst: Record<string, string> = {
    aangemaakt: 'Offerte aangemaakt. Vul hieronder de regels in.',
    opgeslagen: 'Kopgegevens opgeslagen.',
    status: 'Status bijgewerkt.',
  };

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Offerte {offerte.offertenummer != null ? `#${offerte.offertenummer}` : 'concept'}</h1>
          <p className="mt-1 text-sm text-warm">{offerte.organisatie_naam || 'Geen klant gekoppeld'} · {formatDatum(offerte.created_at)}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/offertes/${id}/afdruk`} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Afdrukken / PDF</Link>
          <Link href="/dashboard/offertes" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </div>

      {ok && okTekst[ok] && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">{okTekst[ok]}</p>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft lg:col-span-2">
          <h2 className="font-display text-base font-bold text-ink-900">Kopgegevens</h2>
          <form action={werkOfferteActie} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="offerteId" value={offerte.id} />
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-warm">Klant</label>
              <select name="organisatie_id" className={inputCls} defaultValue={offerte.organisatie_id ?? ''}>
                <option value="">Geen klant gekoppeld</option>
                {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Contactpersoon</label>
              <input name="contactpersoon" defaultValue={offerte.contactpersoon ?? ''} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Geldig tot</label>
              <input type="date" name="geldig_tot" defaultValue={dateInputWaarde(offerte.geldig_tot)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Btw %</label>
              <input name="btw_pct" inputMode="decimal" defaultValue={String(offerte.btw_pct ?? 21)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-warm">Notitie</label>
              <textarea name="notitie" rows={2} defaultValue={offerte.notitie ?? ''} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Kopgegevens opslaan</button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
            <p className="mt-2"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[offerte.status] ?? 'bg-ink-100 text-ink-600'}`}>{offerte.status}</span></p>
            <form action={wijzigStatusActie} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="offerteId" value={offerte.id} />
              <div className="flex-1">
                <label className="block text-xs font-semibold text-warm">Wijzig status</label>
                <select name="status" defaultValue={offerte.status} className={inputCls}>
                  {OFFERTE_STATUSSEN.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
            </form>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-ink-900">Totalen</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-warm">Subtotaal</dt><dd className="text-ink-900">{formatEuro(subtotaal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Btw ({offerte.btw_pct ?? 21}%)</dt><dd className="text-ink-900">{formatEuro(btw)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-extrabold text-ink-900"><dt>Totaal</dt><dd>{formatEuro(totaal)}</dd></div>
            </dl>
          </div>

          <form action={verwijderOfferteActie} className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <input type="hidden" name="offerteId" value={offerte.id} />
            <h2 className="font-display text-base font-bold text-red-800">Offerte verwijderen</h2>
            <p className="mt-1 text-xs text-red-700">Inclusief alle regels. Dit kan niet ongedaan worden gemaakt.</p>
            <ConfirmSubmit message="Deze offerte en alle regels verwijderen?" className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Verwijderen</ConfirmSubmit>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Offerteregels</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {offerte.regels.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen regels op deze offerte.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-3 py-3">Omschrijving</th>
                      <th className="px-3 py-3">Aantal</th>
                      <th className="px-3 py-3">Stukprijs</th>
                      <th className="px-3 py-3 text-right">Regeltotaal</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerte.regels.map((r) => (
                      <tr key={r.id} className="border-b border-line align-top">
                        <td colSpan={5} className="px-3 py-3">
                          <form action={werkRegelActie} className="grid grid-cols-12 items-end gap-2">
                            <input type="hidden" name="offerteId" value={offerte.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <div className="col-span-12 sm:col-span-6">
                              <input name="omschrijving" required defaultValue={r.omschrijving ?? ''} className={inputCls} />
                            </div>
                            <div className="col-span-4 sm:col-span-1">
                              <input name="aantal" inputMode="decimal" defaultValue={String(r.aantal ?? 0)} className={inputCls} />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <input name="stukprijs" inputMode="decimal" defaultValue={String(r.stukprijs ?? 0)} className={inputCls} />
                            </div>
                            <div className="col-span-4 sm:col-span-2 text-right text-sm font-medium text-ink-900">{formatEuro((Number(r.aantal) || 0) * (Number(r.stukprijs) || 0))}</div>
                            <div className="col-span-12 sm:col-span-1 flex gap-2">
                              <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                            </div>
                          </form>
                          <form action={verwijderRegelActie} className="mt-1">
                            <input type="hidden" name="offerteId" value={offerte.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <ConfirmSubmit message="Deze regel verwijderen?" className="text-xs font-semibold text-warm hover:text-ink-800">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-mist"><td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-warm">Subtotaal: <span className="text-ink-900">{formatEuro(subtotaal)}</span></td></tr>
                    <tr className="bg-mist"><td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-warm">Btw ({offerte.btw_pct ?? 21}%): <span className="text-ink-900">{formatEuro(btw)}</span></td></tr>
                    <tr className="bg-mist"><td colSpan={5} className="px-3 py-2 text-right text-sm font-extrabold text-ink-900">Totaal: {formatEuro(totaal)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <RegelToevoegen offerteId={offerte.id} opties={opties} />
        </div>
      </section>
    </main>
  );
}
