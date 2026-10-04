import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { laadKlanten } from '@/lib/kms/analyseData';
import { datumKort, leesPeriode, periodeParams, urlMet } from '@/lib/kms/analysePeriode';
import { klantJaarRapport } from '@/lib/kms/rapportages';
import { site } from '@/content/site';
import AfdrukKnop from '../../_delen/AfdrukKnop';
import AfdrukStijl from '../../_delen/AfdrukStijl';
import KlantFilter from '../../_delen/KlantFilter';
import RapportWeergave from '../../_delen/RapportWeergave';
import { aantal, euro } from '../../../analyse/_delen/opmaak';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapport per klant', robots: { index: false, follow: false } };

export default async function KlantRapport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jaar?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const huidigJaar = Number(leesPeriode({}).vandaag.slice(0, 4));
  const jaar = /^\d{4}$/.test(sp.jaar ?? '') && Number(sp.jaar) >= site.foundedYear && Number(sp.jaar) <= huidigJaar ? Number(sp.jaar) : huidigJaar;

  const [r, klanten] = await Promise.all([klantJaarRapport(id, jaar), laadKlanten()]);
  if (!r) notFound();

  const pp = periodeParams(r.periode, true);
  delete pp.vgl;
  const exp = (rapport: string) => urlMet('/dashboard/rapportages/export', { rapport, formaat: 'xlsx', klant: id }, pp);
  const jaren = Array.from({ length: Math.min(4, huidigJaar - site.foundedYear + 1) }, (_, i) => huidigJaar - i);
  const maxMaand = Math.max(1, ...r.maanden.map((m) => m.gefactureerd));
  const lopend = jaar === huidigJaar;
  const leeg = r.totaal.orders === 0 && r.totaal.gefactureerd === 0;

  return (
    <main className="container-app pb-12">
      <AfdrukStijl />
      <div className="dash-kop justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/dashboard/rapportages" className="knop-tekst -ml-2 shrink-0" aria-label="Terug naar rapportages">&larr;</Link>
          <h1 className="dash-h1 truncate">Rapport per klant</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/klanten/${id}`} className="knop-tekst hidden sm:inline-flex">Naar de klant</Link>
          <AfdrukKnop />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 print:hidden">
        <KlantFilter
          pad="/dashboard/rapportages/klant"
          klanten={[...klanten.values()].map((k) => ({ id: k.id, naam: k.naam }))}
          huidig={id}
          bewaar={{ jaar: String(jaar) }}
          legeOptie={null}
        />
        <div>
          <span className="veld-label">Jaar</span>
          <div className="flex flex-wrap gap-1.5">
            {jaren.map((j) => (
              <Link key={j} href={`/dashboard/rapportages/klant/${id}?jaar=${j}`} className={`chip ${j === jaar ? 'chip-aan' : ''}`}>{j}</Link>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-warm">
          Losse lijsten in Excel:{' '}
          <a href={exp('verstrekkingen')} className="font-semibold text-ink-800 hover:underline">verstrekkingen</a>
          {r.heeftBudget && <>, <a href={exp('budget-medewerker')} className="font-semibold text-ink-800 hover:underline">budget</a></>}
          , <a href={exp('kleding-in-bezit')} className="font-semibold text-ink-800 hover:underline">kleding in bezit</a>
        </p>
      </div>

      <article id="rapport-afdruk" className="mt-5 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-warm">Jaaroverzicht {jaar}{lopend ? ` t/m ${datumKort(r.periode.tot)}` : ''}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">{r.klant.naam}</h2>
            <p className="mt-0.5 text-[13px] text-warm">
              {[r.klant.plaats, r.klant.klantnummer ? `klantnummer ${r.klant.klantnummer}` : null, r.klant.contactpersoon ? `t.a.v. ${r.klant.contactpersoon}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right text-[12px] leading-snug text-warm">
            <p className="font-display text-[15px] font-bold text-ink-900">{site.name}</p>
            <p>{site.address.street}, {site.address.postalCode} {site.address.city}</p>
            <p>{site.phone} · {site.email}</p>
            <p className="mt-1">Gemaakt op {datumKort(r.periode.vandaag)}</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="panel p-3">
            <dt className="text-[12px] font-medium text-warm">Gefactureerd excl. btw</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{euro(r.totaal.gefactureerd)}</dd>
            <dd className="mt-0.5 text-[11px] text-warm">{jaar - 1}{lopend ? ', zelfde periode' : ''}: {euro(r.totaal.gefactureerdVorigJaar)}</dd>
          </div>
          <div className="panel p-3">
            <dt className="text-[12px] font-medium text-warm">Orders</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{aantal(r.totaal.orders)}</dd>
            <dd className="mt-0.5 text-[11px] text-warm">{jaar - 1}{lopend ? ', zelfde periode' : ''}: {aantal(r.totaal.ordersVorigJaar)}</dd>
          </div>
          <div className="panel p-3">
            <dt className="text-[12px] font-medium text-warm">Geleverde stuks</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{aantal(r.totaal.stuks)}</dd>
          </div>
          <div className="panel p-3">
            <dt className="text-[12px] font-medium text-warm">Medewerkers beleverd</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{aantal(r.totaal.medewerkers)}</dd>
          </div>
        </dl>

        {leeg ? (
          <div className="rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-5">
            <p className="text-[13px] font-semibold text-ink-900">Geen orders of facturen in {jaar}</p>
            <p className="mt-1 text-[13px] text-warm">Kies een ander jaar, of maak voor deze klant een order aan.</p>
          </div>
        ) : (
          <>
            <section>
              <h3 className="font-display text-base font-bold text-ink-900">Per maand</h3>
              <div className="panel mt-2 overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Maand</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Stuks</th>
                      <th className="text-right">Gefactureerd</th>
                      <th className="w-1/3 print:hidden"><span className="sr-only">Verloop</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.maanden.map((m) => (
                      <tr key={m.key}>
                        <td className="capitalize">{m.label}</td>
                        <td className="num">{m.orders || <span className="text-ink-300">–</span>}</td>
                        <td className="num">{m.stuks || <span className="text-ink-300">–</span>}</td>
                        <td className="num">{m.gefactureerd ? euro(m.gefactureerd) : <span className="text-ink-300">–</span>}</td>
                        <td className="print:hidden">
                          <span className="block h-1.5 overflow-hidden rounded-full bg-mist">
                            <span className="block h-full rounded-full bg-ink-700" style={{ width: `${(m.gefactureerd / maxMaand) * 100}%` }} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink-200 bg-mist font-semibold">
                      <td className="px-3 py-2">Totaal</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.totaal.orders}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.totaal.stuks}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{euro(r.totaal.gefactureerd)}</td>
                      <td className="print:hidden" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section>
              <h3 className="font-display text-base font-bold text-ink-900">Verstrekkingen per medewerker</h3>
              <div className="mt-2"><RapportWeergave tabel={r.verstrekkingen} /></div>
            </section>

            {r.heeftBudget && (
              <section>
                <h3 className="font-display text-base font-bold text-ink-900">Budgetstand</h3>
                <div className="mt-2"><RapportWeergave tabel={r.budget} /></div>
              </section>
            )}

            {r.artikelen.length > 0 && (
              <section>
                <h3 className="font-display text-base font-bold text-ink-900">Meest geleverde artikelen</h3>
                <div className="panel mt-2 overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Artikel</th>
                        <th className="text-right">Stuks</th>
                        <th className="text-right">Waarde excl. btw</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.artikelen.map((a) => (
                        <tr key={a.naam}>
                          <td>{a.naam}</td>
                          <td className="num">{a.stuks}</td>
                          <td className="num">{euro(a.waarde)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        <footer className="border-t border-line pt-3 text-[11px] leading-snug text-warm">
          Bedragen excl. btw. Orders tellen op besteldatum, facturen op factuurdatum. Vragen over dit overzicht? Bel of mail {site.owner.split(' ')[0]}: {site.phone}, {site.email}.
        </footer>
      </article>
    </main>
  );
}
