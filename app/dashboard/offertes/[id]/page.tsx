import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getOfferte, offerteTotalen, OFFERTE_STATUSSEN, listKlantenVoorOfferte } from '@/lib/kms/offertes';
import KlantContactKiezer from '../KlantContactKiezer';
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
const groot = 'veld py-2.5 text-[15px]';

/** Getal in een invoerveld met een komma als decimaalteken (34,5 in plaats van 34.5). */
function getalTekst(n: number | null): string {
  return String(n ?? 0).replace('.', ',');
}

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

  const [offerte, klanten] = await Promise.all([getOfferte(id), listKlantenVoorOfferte()]);
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
            <form action={werkOfferteActie} className="mt-4 space-y-5">
              <input type="hidden" name="offerteId" value={offerte.id} />
              {/* key: na opslaan opnieuw opbouwen met de opgeslagen klant en contactpersoon. */}
              <KlantContactKiezer
                key={`${offerte.organisatie_id ?? ''}|${offerte.contactpersoon ?? ''}`}
                klanten={klanten}
                beginKlantId={offerte.organisatie_id ?? ''}
                beginContact={offerte.contactpersoon ?? ''}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="veld-label" htmlFor="kop-geldig">Geldig tot</label>
                  <input id="kop-geldig" type="date" name="geldig_tot" defaultValue={dateInputWaarde(offerte.geldig_tot)} className={groot} />
                </div>
                <div>
                  <label className="veld-label" htmlFor="kop-btw">Btw %</label>
                  <input id="kop-btw" name="btw_pct" inputMode="decimal" defaultValue={String(offerte.btw_pct ?? 21)} className={groot} />
                </div>
              </div>
              <div>
                <label className="veld-label" htmlFor="kop-notitie">Notitie</label>
                <textarea id="kop-notitie" name="notitie" rows={4} defaultValue={offerte.notitie ?? ''} placeholder="Toelichting voor de klant" className={groot} />
                <p className="veld-hint">Deze tekst staat onderaan de offerte die de klant krijgt.</p>
              </div>
              <div>
                <button type="submit" className="knop-donker">Kopgegevens opslaan</button>
              </div>
            </form>
          </div>

          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Offerteregels</h2>
            {offerte.regels.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">Nog geen regels op deze offerte. Voeg er hieronder een toe.</p>
            ) : (
              <div className="panel mt-3 overflow-x-auto">
                {/* Vaste kolombreedtes (table-fixed + colgroup): koppen staan exact boven de
                    waarden, ook als een regel een foto of een extra regel met kleur heeft.
                    De invoervelden horen via het form-attribuut bij het formulier in de laatste kolom. */}
                <table className="tbl min-w-[820px] table-fixed">
                  <colgroup>
                    <col className="w-[4.5rem]" />
                    <col />
                    <col className="w-24" />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col className="w-32" />
                    <col className="w-[7.5rem]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th><span className="sr-only">Foto</span></th>
                      <th className="text-left">Omschrijving</th>
                      <th className="text-right">Aantal</th>
                      <th className="text-right">Stukprijs</th>
                      <th className="text-right">Korting %</th>
                      <th className="text-right">Regeltotaal</th>
                      <th><span className="sr-only">Acties</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerte.regels.map((r) => {
                      const formId = `regel-${r.id}`;
                      const regelTotaal = (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0) * (1 - (Number(r.korting_pct) || 0) / 100);
                      return (
                        <tr key={r.id} className="align-top">
                          <td className="py-2.5">
                            {r.afbeelding ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={r.afbeelding} alt={r.kleur ? `Foto in ${r.kleur}` : ''} className="h-12 w-12 rounded border border-line bg-white object-contain" />
                            ) : (
                              <span className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-line text-[10px] text-warm">
                                {r.product_id ? 'geen foto' : 'vrij'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <input form={formId} name="omschrijving" required defaultValue={r.omschrijving ?? ''} aria-label="Omschrijving" className={inputCls} />
                            {r.product_id && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-warm">
                                <span>
                                  Kleur: <span className="font-semibold text-ink-900">{r.kleur || 'standaard'}</span>
                                </span>
                                <label className="flex items-center gap-1.5">
                                  Maat:
                                  <input
                                    form={formId}
                                    name="maat"
                                    defaultValue={r.maat ?? ''}
                                    placeholder="nog niet bekend"
                                    aria-label="Maat"
                                    className="w-32 rounded border border-line px-1.5 py-0.5 text-[12px] text-ink-900 placeholder:text-ink-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                  />
                                </label>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5">
                            <input form={formId} name="aantal" inputMode="decimal" defaultValue={getalTekst(r.aantal)} aria-label="Aantal" className={`${inputCls} text-right tabular-nums`} />
                          </td>
                          <td className="py-2.5">
                            <input form={formId} name="stukprijs" inputMode="decimal" defaultValue={getalTekst(r.stukprijs)} aria-label="Stukprijs" className={`${inputCls} text-right tabular-nums`} />
                          </td>
                          <td className="py-2.5">
                            <input form={formId} name="korting_pct" inputMode="decimal" defaultValue={getalTekst(r.korting_pct)} aria-label="Korting %" className={`${inputCls} text-right tabular-nums`} />
                          </td>
                          <td className="num py-2.5 pt-4 font-semibold text-ink-900">{formatEuro(regelTotaal)}</td>
                          <td className="py-2.5">
                            <div className="flex flex-col items-end gap-1">
                              <form id={formId} action={werkRegelActie}>
                                <input type="hidden" name="offerteId" value={offerte.id} />
                                <input type="hidden" name="regelId" value={r.id} />
                                <button type="submit" className="knop-stil">Opslaan</button>
                              </form>
                              <form action={verwijderRegelActie}>
                                <input type="hidden" name="offerteId" value={offerte.id} />
                                <input type="hidden" name="regelId" value={r.id} />
                                <ConfirmSubmit message="Deze regel verwijderen?" className="text-[12px] font-semibold text-warm hover:text-ink-900">Verwijderen</ConfirmSubmit>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* key: na het toevoegen van een regel begint de kiezer weer leeg. */}
          <RegelToevoegen key={offerte.regels.length} offerteId={offerte.id} organisatieId={offerte.organisatie_id} />

          {pakketten.length > 0 && (
            <div className="panel max-w-xl p-4">
              <h3 className="font-display text-base font-bold text-ink-900">Vast pakket toevoegen</h3>
              <p className="veld-hint">Voeg in een keer alle producten van een klant-pakket toe als regels.</p>
              <form action={voegPakketActie} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="offerteId" value={offerte.id} />
                <select name="pakketId" required defaultValue="" className={`${inputCls} min-w-[16rem] flex-1`}>
                  <option value="">Kies een pakket</option>
                  {pakketten.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
                <button type="submit" className="knop-donker">Pakket toevoegen</button>
              </form>
            </div>
          )}
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
