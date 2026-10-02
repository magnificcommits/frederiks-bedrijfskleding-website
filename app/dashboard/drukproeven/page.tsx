import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties } from '@/lib/kms/pakketten';
import { listDrukproevenVoorKlant, contactAdressenVoorDrukproef } from '@/lib/kms/drukproeven';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import EmptyState from '@/components/dashboard/EmptyState';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import DrukproefPreview from './DrukproefPreview';
import { verwijderDrukproefActie, verstuurDrukproefActie, kopieerDrukproefActie } from './actions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drukproeven', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datum = (s: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s));

const STATUS: Record<string, { label: string; klasse: string }> = {
  concept: { label: 'Concept', klasse: 'bg-ink-100 text-ink-700' },
  verstuurd: { label: 'Wacht op klant', klasse: 'bg-amber-100 text-amber-800' },
  goedgekeurd: { label: 'Goedgekeurd', klasse: 'bg-green-100 text-green-800' },
  afgekeurd: { label: 'Afgekeurd', klasse: 'bg-red-100 text-red-700' },
};

export default async function DrukproevenPage({ searchParams }: { searchParams: Promise<{ org?: string; ok?: string; order?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">De koppeling met de database ontbreekt nog. Neem contact op met Tim.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { org, order } = await searchParams;
  const orgs = await listOrganisaties();
  const gekozen = org && orgs.some((o) => o.id === org) ? org : '';
  const orderId = order && UUID.test(order) ? order : '';

  let klantNaam = '';
  let drukproeven: Awaited<ReturnType<typeof listDrukproevenVoorKlant>> = [];
  let adressen: { email: string; naam: string }[] = [];
  let ordernummer: string | null = null;
  if (gekozen) {
    klantNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';
    [drukproeven, adressen] = await Promise.all([listDrukproevenVoorKlant(gekozen), contactAdressenVoorDrukproef(gekozen)]);
    if (orderId) {
      const { data } = await sb.from('orders').select('ordernummer').eq('id', orderId).maybeSingle();
      ordernummer = (data as { ordernummer: string | null } | null)?.ordernummer ?? null;
    }
  }
  const nieuwHref = `/dashboard/drukproeven/nieuw?org=${gekozen}${orderId ? `&order=${orderId}` : ''}`;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <h1 className="dash-h1">Drukproeven</h1>
        {gekozen && (
          <Link href={nieuwHref} className="knop-primair !px-4 !py-2 !text-sm">
            Nieuwe drukproef
          </Link>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-sm text-warm">
        Zet het logo van de klant op de echte foto van het kledingstuk, op de voor- en achterkant. Daarna stuur je de proef ter goedkeuring naar de klant of print je hem voor de productie.
      </p>

      <section className="mt-6">
        <div className="flex flex-wrap items-end gap-3 panel p-4">
          <div className="min-w-[18rem]">
            <label className="veld-label">Klant</label>
            <div className="mt-1">
              <NavigateSelect options={orgs.map((o) => ({ value: o.id, label: o.naam }))} value={gekozen} basePath="/dashboard/drukproeven" param="org" placeholder="Kies een klant" />
            </div>
          </div>
          {orderId && gekozen && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Een nieuwe drukproef wordt gekoppeld aan order {ordernummer ?? ''}.{' '}
              <Link href={`/dashboard/orders/${orderId}`} className="font-semibold underline">Terug naar de order</Link>
            </p>
          )}
        </div>
      </section>

      {!gekozen ? (
        <div className="mt-8">
          <EmptyState titel="Kies eerst een klant" tekst="Selecteer hierboven een klant om de drukproeven te zien of een nieuwe te maken." />
        </div>
      ) : drukproeven.length === 0 ? (
        <div className="mt-8">
          <EmptyState titel={`Nog geen drukproeven voor ${klantNaam}`} tekst="Maak de eerste drukproef: kies een kledingstuk en zet het logo erop." actieHref={nieuwHref} actieLabel="Nieuwe drukproef" />
        </div>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-ink-900">Drukproeven van {klantNaam}</h2>
            <form id="afdrukvel" action="/dashboard/drukproeven/afdrukken" method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="org" value={gekozen} />
              <span className="text-xs text-warm">Vink proeven aan om ze samen op één vel te zetten.</span>
              <button type="submit" className="knop-stil !px-4 !py-2 !text-sm">Afdrukvel maken</button>
            </form>
          </div>

          {adressen.length > 0 && (
            <datalist id="drukproef-adressen">
              {adressen.map((a) => (
                <option key={a.email} value={a.email}>{a.naam}</option>
              ))}
            </datalist>
          )}

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {drukproeven.map((d) => {
              const status = STATUS[d.status] ?? { label: d.status, klasse: 'bg-ink-100 text-ink-700' };
              const nieuw = Boolean(d.ontwerp);
              return (
                <li key={d.id} className="flex flex-col panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" name="id" value={d.id} form="afdrukvel" className="mt-1 h-4 w-4 accent-amber-500" aria-label={`${d.naam} op het afdrukvel`} />
                      <span>
                        <span className="block font-semibold text-ink-900">{d.naam}</span>
                        <span className="block text-xs text-warm">
                          {[d.product_kleur, d.techniek === 'bedrukken' ? 'Bedrukken' : 'Borduren', `aangemaakt ${datum(d.created_at)}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </label>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.klasse}`}>{status.label}</span>
                  </div>

                  <Link href={`/dashboard/drukproeven/${d.id}`} className="mt-3 block rounded-lg border border-line bg-mist p-3 transition hover:border-amber-400" title="Bewerken">
                    <div className={nieuw ? '' : 'mx-auto w-full max-w-[180px]'}>
                      <DrukproefPreview
                        afbeeldingUrl={d.afbeelding_url}
                        achterAfbeeldingUrl={d.achter_afbeelding_url ?? null}
                        ontwerp={d.ontwerp}
                        formaat="mini"
                        type={d.type}
                        kleur={d.kleur}
                        logoUrl={d.logo_url}
                        positie={d.positie}
                        techniek={d.techniek}
                      />
                    </div>
                  </Link>

                  {d.omschrijving && <p className="mt-2 line-clamp-3 text-xs text-warm">{d.omschrijving}</p>}

                  {(d.status === 'goedgekeurd' || d.status === 'afgekeurd') && d.opmerking && (
                    <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-xs text-ink-700">
                      <span className="font-semibold">Reactie klant:</span> {d.opmerking}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/dashboard/drukproeven/${d.id}`} className="knop-donker">Bewerken</Link>
                    <Link href={`/dashboard/drukproeven/afdrukken?org=${gekozen}&id=${d.id}`} className="knop-stil">Afdrukken</Link>
                    <form action={kopieerDrukproefActie}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="knop-stil" title="Kopie maken, bijvoorbeeld voor een ander kledingstuk met hetzelfde logo">Kopie maken</button>
                    </form>
                  </div>

                  {(d.status === 'concept' || d.status === 'verstuurd') && (
                    <form action={verstuurDrukproefActie} className="mt-3 border-t border-line pt-3">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="org_id" value={gekozen} />
                      <label className="veld-label" htmlFor={`mail-${d.id}`}>Ter goedkeuring mailen naar</label>
                      <div className="mt-1 flex gap-2">
                        <input
                          id={`mail-${d.id}`}
                          type="email"
                          name="email"
                          required
                          list={adressen.length > 0 ? 'drukproef-adressen' : undefined}
                          defaultValue={adressen[0]?.email ?? ''}
                          placeholder="naam@bedrijf.nl"
                          className="veld min-w-0 flex-1 !py-2 !text-sm"
                        />
                        <button type="submit" className="knop-primair shrink-0">
                          {d.status === 'verstuurd' ? 'Opnieuw sturen' : 'Versturen'}
                        </button>
                      </div>
                      <p className="mt-1.5 break-all text-[11px] text-warm">
                        Of deel deze link: {env.siteUrl}/drukproef/{d.token}
                      </p>
                    </form>
                  )}

                  <form action={verwijderDrukproefActie} className="mt-3">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="org_id" value={gekozen} />
                    <ConfirmSubmit message={`Drukproef "${d.naam}" verwijderen? Dit kan niet ongedaan worden gemaakt.`} className="text-xs font-semibold text-red-600 hover:text-red-700">
                      Verwijderen
                    </ConfirmSubmit>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
