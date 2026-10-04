import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import FilterBalk from '@/components/dashboard/FilterBalk';
import { klantLabel } from '@/lib/kms/filterOpties';
import { zoekKlantenVoorFilter } from '@/lib/kms/filterActies';
import { isUuid, param, periodeParam, sleutelsVan, type FilterDef } from '@/lib/filterBalk';
import { startPassessie } from './actions';
import { klantSamenvatting, listSessies, type SessieFilters } from './sessies';
import KlantKiezer from './KlantKiezer';

export const metadata: Metadata = { title: 'Passessies', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Status van een sessie in gewone taal. "Afgerond" alleen zei niet of er al
 * besteld was; nu staat er wat de volgende stap is.
 */
const statusWeergave: Record<string, { label: string; badge: string; uitleg: string }> = {
  open: { label: 'Open', badge: 'badge-actie', uitleg: 'Er kan nog gepast worden.' },
  afgerond: { label: 'Afgerond, nog geen order', badge: 'badge-actie', uitleg: 'Klaar met passen. Open de sessie om er een order van te maken.' },
  omgezet: { label: 'Order gemaakt', badge: 'badge-klaar', uitleg: 'De maten staan op een order.' },
};

/**
 * Elke redirect met ?fout= komt hier als leesbare zin terug. Een kale code als
 * "geen-db" zegt Jessi niets; ze moet lezen wat er misging en wat ze kan doen.
 */
const foutBoodschap: Record<string, string> = {
  'geen-db': 'Geen verbinding met de database. Probeer het zo opnieuw.',
  'geen-klant': 'Kies eerst een klant, dan kan de sessie starten.',
  aanmaken: 'De sessie kon niet worden aangemaakt. Probeer het opnieuw.',
  onbekend: 'Die passessie bestaat niet meer.',
};

function fmt(d: string) {
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default async function PassessiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sp = await searchParams;
  const fout = param(sp, 'fout');
  const klantId = isUuid(param(sp, 'klant')) ? param(sp, 'klant') : '';

  // Filters op de lijst eerdere sessies. Eigen namen (s…), los van de klantkeuze
  // bovenaan: een klant kiezen om te gaan passen hoort de lijst niet te verbergen.
  const sKlant = isUuid(param(sp, 'sklant')) ? param(sp, 'sklant') : null;
  const sStatus = (['open', 'afgerond', 'omgezet'] as const).find((s) => s === param(sp, 'sstatus')) ?? null;
  const sPeriode = periodeParam(sp, 'speriode');
  const sessieFilters: SessieFilters = { klant: sKlant, status: sStatus, van: sPeriode.van, totExclusief: sPeriode.totExclusief };

  const [klant, sessies, sKlantNaam, admin] = await Promise.all([
    klantId ? klantSamenvatting(klantId) : Promise.resolve(null),
    listSessies(sessieFilters),
    klantLabel(sKlant),
    getHuidigeAdmin(),
  ]);

  const filterDefs: FilterDef[] = [
    { soort: 'zoek', param: 'sklant', label: 'Klant', hoofd: true, zoek: zoekKlantenVoorFilter, huidigLabel: sKlantNaam, placeholder: 'Alle klanten' },
    {
      soort: 'select',
      param: 'sstatus',
      label: 'Status',
      hoofd: true,
      opties: [
        { waarde: 'open', label: 'Open' },
        { waarde: 'afgerond', label: 'Afgerond, nog geen order' },
        { waarde: 'omgezet', label: 'Order gemaakt' },
      ],
    },
    { soort: 'datum', param: 'speriode', label: 'Datum', hoofd: true },
  ];
  const lijstGefilterd = filterDefs.some((d) => sleutelsVan(d).some((k) => param(sp, k)));
  const klantNaam = klant ? (klant.plaats ? `${klant.naam} (${klant.plaats})` : klant.naam) : null;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Passen en maten</h1>
        <Link href="/dashboard" className="knop-tekst">
          Terug naar dashboard
        </Link>
      </div>

      {fout && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {foutBoodschap[fout] ?? 'Er ging iets mis. Probeer het opnieuw.'}
        </p>
      )}

      {/* Stap 1: één klantzoeker voor beide keuzes. */}
      <section className="mt-5">
        <h2 className="text-[13px] font-semibold text-ink-900">
          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-[11px] text-white">1</span>
          Bij welke klant ben je?
        </h2>
        <div className="mt-2">
          <KlantKiezer klantId={klantId} klantNaam={klantNaam} />
        </div>
        {klant && (
          <p className="mt-2 text-[13px] text-warm">
            {klant.werknemers === 0
              ? 'Nog geen werknemers ingevoerd bij deze klant. Die kun je tijdens het passen toevoegen.'
              : `${klant.werknemers} ${klant.werknemers === 1 ? 'actieve werknemer' : 'actieve werknemers'}.`}
          </p>
        )}
        {klantId && !klant && <p className="mt-2 text-[13px] text-red-700">Deze klant bestaat niet meer. Kies een andere.</p>}
      </section>

      {/* Stap 2: twee duidelijk verschillende dingen. */}
      <section className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink-900">
          <span className={`mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${klant ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600'}`}>2</span>
          Wat kom je doen?
        </h2>

        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <article className={`panel flex flex-col p-4 ${klant ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-900">Alleen maten vastleggen</h3>
              <span className="badge-rust shrink-0">geen order</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-800">
              Per werknemer noteer je de vaste maat voor elk artikel uit zijn assortiment. Er wordt niets besteld. Bestelt
              de klant later, via het portaal of bij jou, dan staan de maten al klaar.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-warm">
              Bijvoorbeeld: een nieuwe monteur komt even langs de winkel. Jas L, broek 52, schoen 44. Opgeslagen, klaar.
            </p>
            <div className="mt-auto pt-4">
              {klant ? (
                <Link href={`/dashboard/klanten/${klant.id}?tab=werknemers`} className="knop-donker">
                  Naar de werknemers van {klant.naam}
                </Link>
              ) : (
                <span className="text-[12px] text-warm">Kies eerst een klant.</span>
              )}
            </div>
          </article>

          <article className={`panel flex flex-col p-4 ${klant ? 'border-amber-300' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-900">Passessie met bestelling</h3>
              <span className="badge-actie shrink-0">maakt een order</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-800">
              Op locatie past iedereen de kleding. Per werknemer leg je artikel, kleur en maat vast, op de tablet. Na
              afloop zet je de hele sessie in één keer om naar één order.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-warm">
              Bijvoorbeeld: pasdag in de kantine, vijftien man past de nieuwe winterjas. Aan het eind staat er één order
              klaar met alle maten erop.
            </p>

            {klant && klant.openSessies.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                Er staat al een open sessie voor deze klant:
                <ul className="mt-1">
                  {klant.openSessies.map((s) => (
                    <li key={s.id}>
                      <Link href={`/dashboard/passessie/${s.id}`} className="font-semibold underline underline-offset-2 hover:text-ink-900">
                        {fmt(s.datum)}
                        {s.locatie ? `, ${s.locatie}` : ''} ({s.regels} {s.regels === 1 ? 'regel' : 'regels'})
                      </Link>
                    </li>
                  ))}
                </ul>
                Ga daar verder als het dezelfde pasdag is.
              </div>
            )}

            <div className="mt-auto pt-4">
              {klant ? (
                <form action={startPassessie} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="organisatie_id" value={klant.id} />
                  <label className="block">
                    <span className="veld-label">Locatie (optioneel)</span>
                    <input name="locatie" className="veld" placeholder="Kantine, vestiging Hengelo" />
                  </label>
                  <label className="block">
                    <span className="veld-label">Notitie (optioneel)</span>
                    <input name="notitie" className="veld" placeholder="Nieuwe medewerkers najaar" />
                  </label>
                  <div className="sm:col-span-2">
                    <button type="submit" className="knop-primair">Passessie starten</button>
                  </div>
                </form>
              ) : (
                <span className="text-[12px] text-warm">Kies eerst een klant.</span>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-lg font-bold text-ink-900">Eerdere sessies</h2>
          <span className="text-[13px] tabular-nums text-warm">{sessies.length === 200 ? '200+' : sessies.length}</span>
        </div>
        <FilterBalk filters={filterDefs} opslag="passessies" gebruiker={admin?.email} />

        {sessies.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line bg-mist p-6 text-[13px] text-warm">
            {lijstGefilterd ? 'Geen sessies die aan deze filters voldoen.' : 'Nog geen passessies. Kies hierboven een klant en start de eerste.'}
          </p>
        ) : (
          <div className="panel mt-3">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Klant</th>
                  <th className="hidden sm:table-cell">Locatie</th>
                  <th className="num">Regels</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Door</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessies.map((s) => {
                  const st = statusWeergave[s.status] ?? { label: s.status, badge: 'badge-rust', uitleg: '' };
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{fmt(s.datum)}</td>
                      <td className="font-medium text-ink-900">{s.organisatie_naam ?? '-'}</td>
                      <td className="stil hidden sm:table-cell">{s.locatie ?? '-'}</td>
                      <td className="num">{s.regels}</td>
                      <td>
                        <span className={st.badge} title={st.uitleg}>
                          {st.label}
                        </span>
                        {s.status === 'omgezet' && s.order_id && (
                          <Link href={`/dashboard/orders/${s.order_id}`} className="ml-2 text-[12px] font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
                            {s.ordernummer != null ? `Order #${s.ordernummer}` : 'Naar order'}
                          </Link>
                        )}
                      </td>
                      <td className="stil hidden md:table-cell">{s.aangemaakt_door ?? '-'}</td>
                      <td className="text-right">
                        <Link href={`/dashboard/passessie/${s.id}`} className="knop-tekst">
                          {s.status === 'open' ? 'Verder passen' : s.status === 'afgerond' ? 'Order maken' : 'Bekijken'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
