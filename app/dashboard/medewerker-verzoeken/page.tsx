import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { listVerzoeken, type VerzoekMetKlant } from '@/lib/kms/medewerkerVerzoeken';
import { formatEuro, formatDatum } from '@/lib/format';
import EmptyState from '@/components/dashboard/EmptyState';
import { keurGoedActie, wijsAfActie, maatwijzigingActie } from './actions';
import { listMaatwijzigingen } from '@/lib/kms/maatwijzigingen';

export const metadata: Metadata = { title: 'Medewerker-verzoeken', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const statusBadge: Record<string, string> = {
  wacht: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-red-100 text-red-800',
};

const statusLabel: Record<string, string> = {
  wacht: 'Wacht',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
};

function typeLabel(type: string): string {
  if (type === 'toevoegen') return 'Nieuwe medewerker';
  if (type === 'verwijderen') return 'Vertrekkende medewerker';
  return type;
}

export default async function MedewerkerVerzoekenPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { ok } = await searchParams;

  const [wachtend, alle, maten] = await Promise.all([listVerzoeken('wacht'), listVerzoeken(), listMaatwijzigingen()]);
  const matenWacht = maten.filter((m) => m.status === 'wacht');
  const matenKlaar = maten.filter((m) => m.status !== 'wacht').slice(0, 30);
  const behandeld = alle.filter((v) => v.status !== 'wacht');

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Medewerker-verzoeken</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-warm">
        Beheerders dienen via het klantportaal verzoeken in om een medewerker toe te voegen of te laten vertrekken.
        Keur je een verzoek goed, dan voeren we de wijziging meteen door en krijgt de medewerker bericht. Wijs je af, dan
        gebeurt er niets en kun je een korte reden meegeven.
      </p>

      {ok === 'status' && (
        <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Verzoek verwerkt.</p>
      )}
      {ok === 'maat' && <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Maatwijziging verwerkt. De werknemer heeft bericht gekregen.</p>}
      {ok === 'maatfout' && <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-ink-800">Dit verzoek kon niet worden verwerkt. Ververs de pagina.</p>}

      {/* Werkdocument portaal 21 okt, punt 2: maatwijzigingen van werknemers. */}
      <section id="maatwijzigingen" className="mt-8 scroll-mt-20">
        <h2 className="font-display text-xl font-bold text-ink-900">Maatwijzigingen <span className="text-base font-semibold text-warm">({matenWacht.length} open)</span></h2>
        <p className="mt-1 max-w-2xl text-sm text-warm">Werknemers vragen in het portaal een andere maat aan. Keur je goed, dan wordt de geregistreerde maat aangepast en krijgt de werknemer bericht.</p>
        {matenWacht.length === 0 ? (
          <div className="mt-4"><EmptyState tekst="Geen maatwijzigingen die op je wachten." /></div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {matenWacht.map((m) => (
              <article key={m.id} className="panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">{m.medewerker_naam || 'Werknemer'} · {m.organisatie_naam || 'Klant'}</p>
                  <span className="text-xs text-warm">{formatDatum(m.created_at) || '-'}</span>
                </div>
                <p className="mt-2 text-sm text-ink-800">
                  {m.product_naam || 'Artikel'}: <span className="font-semibold">{m.huidige_maat ?? 'geen maat'}</span> naar <span className="font-semibold text-amber-800">{m.gewenste_maat}</span>
                </p>
                {m.toelichting && <p className="mt-1 text-sm text-warm">&ldquo;{m.toelichting}&rdquo;</p>}
                <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-line pt-4">
                  <form action={maatwijzigingActie}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="besluit" value="goedgekeurd" />
                    <button type="submit" className="knop-donker">Maat aanpassen</button>
                  </form>
                  <form action={maatwijzigingActie} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="besluit" value="afgewezen" />
                    <input type="text" name="notitie" placeholder="Reden (optioneel, gaat naar de werknemer)" className="w-full rounded-md border border-line px-3 py-2 text-sm sm:flex-1" />
                    <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Afwijzen</button>
                  </form>
                </div>
                <Link href={`/dashboard/klanten/${m.organisatie_id}?tab=werknemers&maten=${m.medewerker_id}`} className="mt-3 inline-block text-xs font-semibold text-amber-700 hover:text-amber-800">Alle maten van deze werknemer</Link>
              </article>
            ))}
          </div>
        )}
        {matenKlaar.length > 0 && (
          <ul className="mt-4 divide-y divide-line overflow-hidden panel">
            {matenKlaar.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="text-ink-900">{m.medewerker_naam || 'Werknemer'} · {m.product_naam || 'Artikel'} · {m.huidige_maat ?? '?'} naar {m.gewenste_maat}{m.notitie ? `: ${m.notitie}` : ''}</span>
                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[m.status] ?? ''}`}>{statusLabel[m.status] ?? m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Wacht op goedkeuring</h2>
        {wachtend.length === 0 ? (
          <div className="mt-4">
            <EmptyState tekst="Geen verzoeken die op goedkeuring wachten." />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {wachtend.map((v) => (
              <article key={v.id} className="panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {typeLabel(v.type)}
                  </span>
                  <span className="text-xs text-warm">{formatDatum(v.created_at) || '-'}</span>
                </div>

                <p className="mt-3 text-sm font-semibold text-ink-900">{v.organisatie_naam || 'Onbekende klant'}</p>

                <dl className="mt-3 space-y-1.5 text-sm">
                  {v.type === 'toevoegen' ? (
                    <>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-warm">Naam</dt>
                        <dd className="text-ink-900">{v.naam || '-'}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-warm">E-mail</dt>
                        <dd className="break-all text-ink-900">{v.email || '-'}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-warm">Functie</dt>
                        <dd className="text-ink-900">{v.functie || '-'}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-warm">Budget</dt>
                        <dd className="text-ink-900">{v.budget != null ? formatEuro(v.budget) : '-'}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-warm">Medewerker</dt>
                      <dd className="text-ink-900">{v.medewerker_naam || v.naam || '-'}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-warm">Aangevraagd</dt>
                    <dd className="text-ink-900">{v.aangevraagd_door || '-'}</dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <form action={keurGoedActie}>
                      <input type="hidden" name="id" value={v.id} />
                      <button type="submit" className="knop-donker">
                        Goedkeuren
                      </button>
                    </form>
                    <form action={wijsAfActie} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                      <input type="hidden" name="id" value={v.id} />
                      <input
                        type="text"
                        name="notitie"
                        placeholder="Reden (optioneel)"
                        className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:flex-1"
                      />
                      <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">
                        Afwijzen
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Behandeld</h2>
        {behandeld.length === 0 ? (
          <div className="mt-4">
            <EmptyState tekst="Nog niets behandeld." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden panel">
            {behandeld.map((v: VerzoekMetKlant) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    {typeLabel(v.type)} &middot; {v.organisatie_naam || 'Onbekende klant'}
                  </p>
                  <p className="text-xs text-warm">
                    {v.type === 'toevoegen' ? v.naam || '-' : v.medewerker_naam || v.naam || '-'}
                    {v.notitie ? `: ${v.notitie}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-warm">
                  <span>{v.behandeld_door || '-'}</span>
                  <span>{formatDatum(v.behandeld_op) || '-'}</span>
                  <span className={`inline-block rounded-full px-2.5 py-1 font-semibold ${statusBadge[v.status] ?? 'bg-ink-100 text-ink-600'}`}>
                    {statusLabel[v.status] ?? v.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
