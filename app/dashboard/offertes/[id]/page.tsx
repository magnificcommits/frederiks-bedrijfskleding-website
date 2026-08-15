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
  mailOfferteActie,
  maakOrderVanOfferteActie,
  voegPakketActie,
} from './actions';
import RegelToevoegen from './RegelToevoegen';
import TotaalKaart from '@/components/dashboard/TotaalKaart';
import { listPakketten } from '@/lib/kms/pakketten';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offerte', robots: { index: false, follow: false } };

const inputCls = 'veld';

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

export default async function OfferteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/offertes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </main>
    );
  }

  const [offerte, organisaties] = await Promise.all([getOfferte(id), listOrganisaties()]);
  if (!offerte) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Offerte niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze offerte bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/offertes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </main>
    );
  }

  const { subtotaal, korting, btw, totaal, marge } = offerteTotalen(offerte.regels, offerte.btw_pct);
  const opties = await getKlantProductOpties(offerte.organisatie_id);
  const pakketten = offerte.organisatie_id ? await listPakketten(offerte.organisatie_id) : [];
  const verlopen = !!offerte.geldig_tot && offerte.status !== 'geaccepteerd' && offerte.status !== 'afgewezen' && new Date(offerte.geldig_tot) < new Date(new Date().toDateString());

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <div>
          <h1 className="dash-h1">Offerte {offerte.offertenummer != null ? `#${offerte.offertenummer}` : 'concept'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/offertes/${id}/afdruk`} className="knop-stil">Afdrukken / PDF</Link>
          <Link href="/dashboard/offertes" className="knop-tekst">Terug naar offertes</Link>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-warm">{offerte.organisatie_naam || 'Geen klant gekoppeld'} · {formatDatum(offerte.created_at)}</p>

      {/* Werkblad links, financiën en acties in een meelopend spoor rechts. */}
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Kopgegevens</h2>
            <form action={werkOfferteActie} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="offerteId" value={offerte.id} />
              <div className="sm:col-span-2">
                <label className="veld-label">Klant</label>
                <select name="organisatie_id" className={inputCls} defaultValue={offerte.organisatie_id ?? ''}>
                  <option value="">Geen klant gekoppeld</option>
                  {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
                </select>
              </div>
              <div>
                <label className="veld-label">Contactpersoon</label>
                <input name="contactpersoon" defaultValue={offerte.contactpersoon ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Geldig tot</label>
                <input type="date" name="geldig_tot" defaultValue={dateInputWaarde(offerte.geldig_tot)} className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Btw %</label>
                <input name="btw_pct" inputMode="decimal" defaultValue={String(offerte.btw_pct ?? 21)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="veld-label">Notitie</label>
                <textarea name="notitie" rows={2} defaultValue={offerte.notitie ?? ''} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="knop-donker">Kopgegevens opslaan</button>
              </div>
            </form>
          </div>

          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Offerteregels</h2>
            {offerte.regels.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">Nog geen regels op deze offerte. Voeg er hieronder een toe.</p>
            ) : (
              <div className="panel mt-3">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Omschrijving</th>
                      <th className="w-20">Aantal</th>
                      <th className="w-28">Stukprijs</th>
                      <th className="w-20">Korting</th>
                      <th className="num w-28">Regeltotaal</th>
                      <th className="w-28"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerte.regels.map((r) => (
                      <tr key={r.id}>
                        <td colSpan={6}>
                          <form action={werkRegelActie} className="grid grid-cols-12 items-center gap-2">
                            <input type="hidden" name="offerteId" value={offerte.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <div className="col-span-12 sm:col-span-5">
                              <input name="omschrijving" required defaultValue={r.omschrijving ?? ''} aria-label="Omschrijving" className={inputCls} />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                              <input name="aantal" inputMode="decimal" defaultValue={String(r.aantal ?? 0)} aria-label="Aantal" className={inputCls} />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <input name="stukprijs" inputMode="decimal" defaultValue={String(r.stukprijs ?? 0)} aria-label="Stukprijs" className={inputCls} />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <input name="korting_pct" inputMode="decimal" defaultValue={String(r.korting_pct ?? 0)} aria-label="Korting %" title="Korting %" className={inputCls} />
                            </div>
                            <div className="col-span-3 sm:col-span-2 text-right text-[13px] font-semibold tabular-nums text-ink-900">{formatEuro((Number(r.aantal) || 0) * (Number(r.stukprijs) || 0) * (1 - (Number(r.korting_pct) || 0) / 100))}</div>
                            <div className="col-span-12 flex items-center gap-3 sm:col-span-1 sm:justify-end">
                              <button type="submit" className="knop-stil">Opslaan</button>
                            </div>
                          </form>
                          <form action={verwijderRegelActie} className="mt-1">
                            <input type="hidden" name="offerteId" value={offerte.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <ConfirmSubmit message="Deze regel verwijderen?" className="text-[11px] font-semibold text-warm hover:text-ink-900">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <RegelToevoegen offerteId={offerte.id} opties={opties} />
            {pakketten.length > 0 && (
              <div className="panel p-4">
                <h3 className="font-display text-base font-bold text-ink-900">Vast pakket toevoegen</h3>
                <p className="veld-hint">Voeg in een keer alle producten van een klant-pakket toe als regels.</p>
                <form action={voegPakketActie} className="mt-3">
                  <input type="hidden" name="offerteId" value={offerte.id} />
                  <select name="pakketId" required defaultValue="" className={inputCls}>
                    <option value="">Kies een pakket</option>
                    {pakketten.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                  </select>
                  <button type="submit" className="knop-donker mt-2 w-full">Pakket toevoegen</button>
                </form>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-16">
          <TotaalKaart
            regels={[
              ...(korting > 0 ? [{ label: 'Korting', waarde: korting, mindering: true }] : []),
              { label: 'Subtotaal', waarde: subtotaal },
              { label: `Btw (${offerte.btw_pct ?? 21}%)`, waarde: btw },
            ]}
            totaal={totaal}
            marge={marge !== 0 ? marge : null}
            toelichting="Indicatie op basis van de inkoopprijs per regel."
          />

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
              <span className={`badge ${statusBadge[offerte.status] ?? 'bg-ink-100 text-ink-600'}`}>{offerte.status}</span>
            </div>
            <form action={wijzigStatusActie} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="offerteId" value={offerte.id} />
              <div className="flex-1">
                <label className="veld-label">Wijzig status</label>
                <select name="status" defaultValue={offerte.status} className={inputCls}>
                  {OFFERTE_STATUSSEN.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button type="submit" className="knop-stil">Opslaan</button>
            </form>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Versturen en omzetten</h2>
            {verlopen && <p className="badge-actie mt-2 block px-3 py-2">Deze offerte is verlopen ({formatDatum(offerte.geldig_tot)}).</p>}
            <form action={mailOfferteActie} className="mt-3">
              <input type="hidden" name="offerteId" value={offerte.id} />
              <label className="veld-label">Mail offerte naar</label>
              <input name="to" type="email" defaultValue={offerte.organisatie_email ?? ''} placeholder="klant@bedrijf.nl" className={inputCls} />
              <button type="submit" className="knop-donker mt-2 w-full">Mail naar klant</button>
            </form>
            <form action={maakOrderVanOfferteActie} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="offerteId" value={offerte.id} />
              <button type="submit" disabled={!offerte.organisatie_id} className="knop-primair w-full">Omzetten naar order</button>
              {!offerte.organisatie_id && <p className="veld-hint">Koppel eerst een klant om een order te maken.</p>}
            </form>
          </div>

          <form action={verwijderOfferteActie} className="rounded-lg border border-red-200 bg-red-50 p-4">
            <input type="hidden" name="offerteId" value={offerte.id} />
            <h2 className="font-display text-base font-bold text-red-800">Offerte verwijderen</h2>
            <p className="mt-1 text-[12px] text-red-700">Inclusief alle regels. Dit kan niet ongedaan worden gemaakt.</p>
            <ConfirmSubmit message="Deze offerte en alle regels verwijderen?" className="knop mt-3 border border-red-300 bg-white text-red-700 hover:bg-red-100">Verwijderen</ConfirmSubmit>
          </form>
        </aside>
      </div>
    </main>
  );
}
