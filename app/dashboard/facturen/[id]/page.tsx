import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getFactuur, getFactuurMailLog, factuurEmailSuggestie, factuurTotalen, regelBedrag, vervaldatumVoor, klantKortingPct, FACTUUR_STATUSSEN } from '@/lib/kms/facturen';
import { werkRegel, verwijderRegel, wijzigStatus, zetFactuurEmailActie, mailFactuurKlantActie } from './actions';
import PrintKnop from './PrintKnop';
import FactuurRegelToevoegen from './FactuurRegelToevoegen';
import TotaalKaart from '@/components/dashboard/TotaalKaart';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import FactuurDocument from '@/components/dashboard/FactuurDocument';
import { DOCUMENT_ID, DocumentAfdrukStijl } from '@/components/dashboard/DocumentOnderdelen';
import { bedrijf } from '@/content/bedrijf';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Factuur', robots: { index: false, follow: false } };

const inputCls = 'veld';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
/** Getal met komma, zonder overbodige nullen (2,5 en niet 2,50). */
const getalTekst = (n: number | null | undefined) => String(Number(n) || 0).replace('.', ',');
function fmtTijd(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

const OK_TEKST: Record<string, string> = {
  toegevoegd: 'Regel toegevoegd.',
  opgeslagen: 'Regel opgeslagen.',
  verwijderd: 'Regel verwijderd.',
  status: 'Status bijgewerkt.',
  adres: 'Factuuradres opgeslagen.',
  gemaild: 'Factuur gemaild naar de klant.',
};
const FOUT_TEKST: Record<string, string> = {
  omschrijving: 'Vul een omschrijving in.',
  regel: 'De regel kon niet worden opgeslagen. Probeer het nog eens.',
  status: 'De status kon niet worden gewijzigd.',
};

const STATUS_LABEL: Record<string, string> = { concept: 'Concept', verzonden: 'Verzonden', betaald: 'Betaald' };

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verzonden: 'bg-amber-100 text-amber-800',
  betaald: 'bg-green-100 text-green-800',
};

export default async function FactuurDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mailfout?: string; ok?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id } = await params;
  const { mailfout, ok, fout } = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/facturen" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar facturen</Link>
        </div>
      </main>
    );
  }

  const [factuur, mailLog] = await Promise.all([getFactuur(id), getFactuurMailLog(id)]);
  if (!factuur) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Factuur niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze factuur bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/facturen" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar facturen</Link>
        </div>
      </main>
    );
  }

  const org = factuur.organisatie;
  // Waar komt het factuuradres vandaan? Het voorstel volgt factuurEmailVoor:
  // facturatiecontact, dan factuur-e-mail, dan algemeen e-mailadres, dan hoofdcontact.
  const [suggestie, klantKorting] = await Promise.all([factuurEmailSuggestie(factuur.organisatie_id), klantKortingPct(factuur.organisatie_id)]);
  const huidigAdres = factuur.factuur_email?.trim() || '';
  const adresInVeld = huidigAdres || suggestie?.email || '';
  const zelfdeAlsVoorstel = !!suggestie && huidigAdres.toLowerCase() === suggestie.email.toLowerCase();
  // Totalen uit de regels zelf (btw per tarief), zodat scherm, afdruk en mail altijd optellen.
  const totalen = factuurTotalen(factuur.regels);
  const { excl, btw, incl } = totalen;
  const heeftKorting = factuur.regels.some((r) => (Number(r.korting_pct) || 0) !== 0);
  // Op de afdruk van een concept staat de vervaldatum die bij verzenden wordt gezet.
  const vervaldatum = factuur.vervaldatum ?? vervaldatumVoor(factuur.factuurdatum);
  const btwRegels = totalen.perTarief.length > 1
    ? totalen.perTarief.map((t) => ({ label: `Btw ${getalTekst(t.pct)}%`, waarde: t.btw }))
    : [{ label: totalen.perTarief.length === 1 ? `Btw (${getalTekst(totalen.perTarief[0].pct)}%)` : 'Btw', waarde: btw }];

  return (
    <main className="container-app py-6">
      {/* Alleen het factuurdocument onderaan gaat op papier; zie DocumentAfdrukStijl. */}
      <DocumentAfdrukStijl voetLabel={`Factuur ${factuur.factuurnummer || 'concept'} · ${bedrijf.naam}`} />

      <div className="dash-kop justify-between gap-4 print:hidden">
        <div>
          <h1 className="dash-h1">Factuur {factuur.factuurnummer || 'concept'}</h1>
          <p className="mt-1 text-sm text-warm">{org?.naam || 'Onbekende klant'} · {fmt(factuur.factuurdatum)}</p>
        </div>
        <div className="flex items-center gap-4">
          {factuur.order_id && (
            <Link href={`/dashboard/orders/${factuur.order_id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Bekijk order</Link>
          )}
          <PrintKnop />
          <Link href="/dashboard/facturen" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar facturen</Link>
        </div>
      </div>

      {ok && OK_TEKST[ok] && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-[13px] font-semibold text-green-800 print:hidden">{OK_TEKST[ok]}</p>
      )}
      {fout && FOUT_TEKST[fout] && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800 print:hidden">{FOUT_TEKST[fout]}</p>
      )}

      {/* Werkblad links, totalen en gegevens in een meelopend spoor rechts. */}
      <div className="mt-4 grid items-start gap-6 print:hidden lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
      <section className="space-y-4 print:hidden">
        <h2 className="font-display text-xl font-bold text-ink-900">Factuurregels</h2>
          {factuur.regels.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">Nog geen regels op deze factuur. Voeg er hieronder een toe.</p>
          ) : (
            <div className="panel overflow-x-auto">
              {/* Vaste kolombreedtes (table-fixed + colgroup): koppen staan exact boven de
                  waarden. De invoervelden horen via het form-attribuut bij het formulier
                  in de laatste kolom, zodat elke regel één rij blijft. */}
              <table className="tbl min-w-[900px] table-fixed">
                <colgroup>
                  <col className="w-[4.5rem]" />
                  <col />
                  <col className="w-20" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-28" />
                  <col className="w-[7rem]" />
                </colgroup>
                <thead>
                  <tr>
                    <th><span className="sr-only">Foto</span></th>
                    <th className="text-left">Omschrijving</th>
                    <th className="text-right">Aantal</th>
                    <th className="text-right">Stukprijs</th>
                    <th className="text-right">Korting %</th>
                    <th className="text-right">Btw %</th>
                    <th className="text-right">Bedrag</th>
                    <th><span className="sr-only">Acties</span></th>
                  </tr>
                </thead>
                <tbody>
                  {factuur.regels.map((r) => {
                    const formId = `regel-${r.id}`;
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
                          <input form={formId} name="omschrijving" required defaultValue={r.omschrijving} aria-label="Omschrijving" className={inputCls} />
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
                                  placeholder="geen"
                                  aria-label="Maat"
                                  className="w-24 rounded border border-line px-1.5 py-0.5 text-[12px] text-ink-900 placeholder:text-ink-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
                          {r.korting_pct !== undefined ? (
                            <input form={formId} name="korting_pct" inputMode="decimal" defaultValue={getalTekst(r.korting_pct)} aria-label="Korting %" className={`${inputCls} text-right tabular-nums`} />
                          ) : (
                            <span className="block pt-2 text-right text-warm">-</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <input form={formId} name="btw_pct" inputMode="decimal" defaultValue={getalTekst(r.btw_pct ?? 21)} aria-label="Btw %" className={`${inputCls} text-right tabular-nums`} />
                        </td>
                        <td className="num py-2.5 pt-4 font-semibold text-ink-900">{euro(regelBedrag(r))}</td>
                        <td className="py-2.5">
                          <div className="flex flex-col items-end gap-1">
                            <form id={formId} action={werkRegel}>
                              <input type="hidden" name="factuurId" value={factuur.id} />
                              <input type="hidden" name="regelId" value={r.id} />
                              <button type="submit" className="knop-stil">Opslaan</button>
                            </form>
                            <form action={verwijderRegel}>
                              <input type="hidden" name="factuurId" value={factuur.id} />
                              <input type="hidden" name="regelId" value={r.id} />
                              <ConfirmSubmit message="Deze factuurregel verwijderen?" className="text-[12px] font-semibold text-warm hover:text-ink-900">Verwijderen</ConfirmSubmit>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {heeftKorting && (
                    <tr className="bg-mist">
                      <td colSpan={6} className="py-2 text-right text-[13px] text-warm">Waarvan korting</td>
                      <td className="num py-2 text-[13px] text-warm">{euro(-totalen.korting)}</td>
                      <td />
                    </tr>
                  )}
                  <tr className="bg-mist">
                    <td colSpan={6} className="py-2 text-right text-[13px] font-semibold text-warm">Subtotaal excl. btw</td>
                    <td className="num py-2 text-ink-900">{euro(excl)}</td>
                    <td />
                  </tr>
                  {btwRegels.map((b) => (
                    <tr key={b.label} className="bg-mist">
                      <td colSpan={6} className="py-2 text-right text-[13px] font-semibold text-warm">{b.label}</td>
                      <td className="num py-2 text-ink-900">{euro(b.waarde)}</td>
                      <td />
                    </tr>
                  ))}
                  <tr className="bg-mist">
                    <td colSpan={6} className="py-2 text-right text-[13px] font-extrabold text-ink-900">Totaal incl. btw</td>
                    <td className="num py-2 font-extrabold text-ink-900">{euro(incl)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        {/* key: na het toevoegen van een regel begint de kiezer weer leeg. */}
        <FactuurRegelToevoegen key={factuur.regels.length} factuurId={factuur.id} organisatieId={factuur.organisatie_id} klantKorting={klantKorting} />
      </section>

      <section className="print:hidden">
        <h2 className="font-display text-xl font-bold text-ink-900">Verzendlogboek boekhouder</h2>
        <div className="mt-4 max-w-2xl panel p-4">
          {mailLog.length === 0 ? (
            <p className="text-sm text-warm">Nog niet naar de boekhouder gemaild.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {mailLog.map((log, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-ink-900">{fmtTijd(log.verzonden_op)}</span>
                  <span className="text-warm">{log.naar_email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      </div>

      <aside className="space-y-4 lg:sticky lg:top-16">
        <TotaalKaart
          regels={[
            ...(totalen.korting > 0 ? [{ label: 'Korting', waarde: totalen.korting, mindering: true }] : []),
            { label: 'Subtotaal excl. btw', waarde: excl },
            ...btwRegels,
          ]}
          totaalLabel="Totaal incl. btw"
          totaal={incl}
        />
        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Versturen naar klant</h2>
          {mailfout && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{mailfout}</p>
          )}
          <form action={zetFactuurEmailActie} className="mt-3">
            <input type="hidden" name="factuurId" value={factuur.id} />
            <label className="veld-label" htmlFor="factuur-email">Factuur mailen naar</label>
            <input
              id="factuur-email"
              name="factuur_email"
              type="email"
              defaultValue={adresInVeld}
              placeholder="facturen@klant.nl"
              className="veld py-2 text-[14px]"
            />
            <p className="veld-hint">
              {!huidigAdres && suggestie && <>Voorstel uit {suggestie.herkomst}. Nog niet opgeslagen op deze factuur.</>}
              {huidigAdres && zelfdeAlsVoorstel && <>Dit adres komt van {suggestie!.herkomst}.</>}
              {huidigAdres && suggestie && !zelfdeAlsVoorstel && (
                <>Op deze factuur staat een ander adres dan de klantkaart voorstelt: {suggestie.email} ({suggestie.herkomst}).</>
              )}
              {huidigAdres && !suggestie && (
                <>Ingevuld voor deze factuur. Op de klantkaart staat geen facturatiecontact, factuur-e-mailadres, algemeen e-mailadres of hoofdcontact met e-mail.</>
              )}
              {!huidigAdres && !suggestie && (
                <>
                  Bij deze klant staat nog geen adres voor facturen. Vink bij een contactpersoon <strong>Facturatie</strong> aan op de{' '}
                  <Link href={`/dashboard/klanten/${factuur.organisatie_id}`} className="font-semibold text-amber-700 hover:text-amber-800">klantkaart</Link>, of typ hier een adres.
                </>
              )}
              {suggestie && suggestie.bron !== 'facturatiecontact' && (
                <>
                  {' '}Er is geen contactpersoon met <strong>Facturatie</strong> aangevinkt op de{' '}
                  <Link href={`/dashboard/klanten/${factuur.organisatie_id}`} className="font-semibold text-amber-700 hover:text-amber-800">klantkaart</Link>.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {/* Opslaan staat eerst: Enter in het adresveld slaat alleen op en mailt niet per ongeluk. */}
              <button type="submit" className="knop-stil w-full">Adres opslaan</button>
              <button type="submit" formAction={mailFactuurKlantActie} disabled={factuur.regels.length === 0} className="knop-donker w-full disabled:opacity-50">
                {factuur.status === 'concept' ? 'Factuur mailen naar klant' : 'Factuur opnieuw mailen'}
              </button>
              {huidigAdres && suggestie && !zelfdeAlsVoorstel && (
                <button type="submit" name="herstel_email" value={suggestie.email} className="knop-tekst w-full">
                  Terugzetten naar {suggestie.email}
                </button>
              )}
            </div>
            <p className="veld-hint">
              Het adres geldt alleen voor deze factuur.
              {factuur.status === 'concept' ? ` Na het mailen gaat de factuur op Verzonden, met vervaldatum ${fmt(vervaldatum)}.` : ''}
            </p>
          </form>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Factuurgegevens</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-warm">Factuurnummer</dt><dd className="font-medium text-ink-900">{factuur.factuurnummer || 'concept'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Factuurdatum</dt><dd className="text-ink-900">{fmt(factuur.factuurdatum)}</dd></div>
            <div className="flex justify-between gap-3">
              <dt className="text-warm">Vervaldatum</dt>
              <dd className="text-right text-ink-900">
                {factuur.vervaldatum ? fmt(factuur.vervaldatum) : <span className="text-warm">{fmt(vervaldatum)} (bij verzenden)</span>}
              </dd>
            </div>
            {factuur.betaaldatum && <div className="flex justify-between gap-3"><dt className="text-warm">Betaald op</dt><dd className="text-ink-900">{fmt(factuur.betaaldatum)}</dd></div>}
            {factuur.order_id && (
              <div className="flex justify-between gap-3"><dt className="text-warm">Order</dt><dd><Link href={`/dashboard/orders/${factuur.order_id}`} className="font-semibold text-amber-700 hover:text-amber-800">Bekijk order</Link></dd></div>
            )}
          </dl>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Klant</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-warm">Naam</dt><dd className="text-right font-medium text-ink-900">{org ? <Link href={`/dashboard/klanten/${org.id}`} className="hover:text-amber-700">{org.naam}</Link> : '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Adres</dt><dd className="text-right text-ink-900">{org?.adres || '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Postcode/plaats</dt><dd className="text-right text-ink-900">{[org?.postcode, org?.plaats].filter(Boolean).join(' ') || '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-warm">Btw-nummer</dt><dd className="text-ink-900">{org?.btw_nummer || '-'}</dd></div>
          </dl>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
          <p className="mt-2"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[factuur.status] ?? 'bg-ink-100 text-ink-600'}`}>{STATUS_LABEL[factuur.status] ?? factuur.status}</span></p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FACTUUR_STATUSSEN.map((st) => {
              const actief = factuur.status === st;
              return (
                <form key={st} action={wijzigStatus}>
                  <input type="hidden" name="factuurId" value={factuur.id} />
                  <input type="hidden" name="status" value={st} />
                  <button
                    type="submit"
                    disabled={actief}
                    aria-pressed={actief}
                    className={
                      actief
                        ? 'cursor-default rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-white'
                        : 'rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-mist'
                    }
                  >
                    {STATUS_LABEL[st]}
                  </button>
                </form>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-warm">
            Bij Verzonden wordt de vervaldatum factuurdatum plus {bedrijf.betaaltermijnDagen} dagen (als die nog leeg is). Bij Betaald wordt de betaaldatum vandaag. Terug naar Concept of Verzonden haalt de betaaldatum weg.
          </p>
        </div>
      </aside>
      </div>

      {/* De factuur zoals de klant hem krijgt. Dit vel gaat ook op papier bij Afdrukken / PDF. */}
      <section aria-labelledby="factuur-voorbeeld-kop" className="mt-12 print:mt-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 print:hidden">
          <h2 id="factuur-voorbeeld-kop" className="font-display text-xl font-bold text-ink-900">Zo krijgt de klant de factuur</h2>
          <p className="text-[12px] text-warm">Afdrukken / PDF drukt alleen dit vel af. Zet &quot;Kop- en voetteksten&quot; uit in het afdrukvenster.</p>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg bg-ink-100 p-4 sm:p-6">
          <article id={DOCUMENT_ID} className="mx-auto w-[210mm] min-w-[210mm] bg-white p-[14mm] shadow-card">
            <FactuurDocument
              factuur={{
                factuurnummer: factuur.factuurnummer,
                factuurdatum: factuur.factuurdatum,
                vervaldatum,
                status: factuur.status,
                betaaldatum: factuur.betaaldatum,
                toegepaste_prijsafspraken: factuur.toegepaste_prijsafspraken,
                organisatie: org
                  ? { naam: org.naam, adres: org.adres, postcode: org.postcode, plaats: org.plaats, btw_nummer: org.btw_nummer, klantnummer: org.klantnummer }
                  : null,
                regels: factuur.regels,
              }}
            />
          </article>
        </div>
      </section>
    </main>
  );
}
