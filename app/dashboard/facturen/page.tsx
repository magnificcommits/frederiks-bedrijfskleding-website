import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed, eisEigenaar, getHuidigeAdmin } from '@/lib/kms/adminClient';
import StatusChips from '@/components/dashboard/StatusChips';
import Zoekbalk from '@/components/dashboard/Zoekbalk';
import FilterBalk from '@/components/dashboard/FilterBalk';
import { telPerStatus } from '@/lib/kms/tellingen';
import { listFacturenPaged, listOrganisaties, listFactureerbareOrders, getBoekhouderEmail, FACTUUR_STATUSSEN, type FactuurLijstFilters } from '@/lib/kms/facturen';
import { klantLabel } from '@/lib/kms/filterOpties';
import { zoekKlantenVoorFilter } from '@/lib/kms/filterActies';
import { bedragParam, bewaarParams, isUuid, lijstUrl, param, periodeParam, sleutelsVan, type FilterDef } from '@/lib/filterBalk';
import SortableTh from '@/components/dashboard/SortableTh';
import EmptyState from '@/components/dashboard/EmptyState';
import { factuurVanOrder, legeFactuur, zetBoekhouderEmailActie, mailFacturenActie, factureerAlleActie, markeerBetaaldActie } from './actions';
import { bulkDoorzettenActie } from './boekhoudActions';
import BoekhoudBadge from '@/components/dashboard/BoekhoudBadge';
import { isMoneybirdGeconfigureerd } from '@/lib/kms/moneybird';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Facturen', robots: { index: false, follow: false } };

const inputCls = 'veld';
const PER_PAGINA = 25;
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

/** Begin en eind (inclusief) van het vorige kwartaal, als standaard voor de export. */
function vorigKwartaal(): { van: string; tot: string } {
  const nu = new Date();
  const k = Math.floor(nu.getUTCMonth() / 3);
  const jaar = k === 0 ? nu.getUTCFullYear() - 1 : nu.getUTCFullYear();
  const startMaand = k === 0 ? 9 : (k - 1) * 3;
  const van = new Date(Date.UTC(jaar, startMaand, 1));
  const tot = new Date(Date.UTC(jaar, startMaand + 3, 0));
  return { van: van.toISOString().slice(0, 10), tot: tot.toISOString().slice(0, 10) };
}

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verzonden: 'bg-amber-100 text-amber-800',
  betaald: 'bg-green-100 text-green-800',
};

export default async function FacturenPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const status = param(sp, 'status');
  const order = param(sp, 'order');
  const ok = param(sp, 'ok');
  const gemaild = param(sp, 'gemaild');
  const mailfout = param(sp, 'mailfout');
  const aantal = param(sp, 'aantal');
  const bkok = param(sp, 'melding');
  const sort = param(sp, 'sort') || undefined;
  const zoekTerm = param(sp, 'zoek');
  const huidigePagina = Math.max(1, Number(param(sp, 'pagina')) || 1);
  const richting = param(sp, 'dir') === 'asc' ? 'asc' : 'desc';

  const klantId = isUuid(param(sp, 'klant')) ? param(sp, 'klant') : null;
  const periode = periodeParam(sp, 'datum');
  const bedrag = bedragParam(sp, 'bedrag');
  const gemaildFilter = param(sp, 'gemaild_filter') === 'ja' || param(sp, 'gemaild_filter') === 'nee' ? (param(sp, 'gemaild_filter') as 'ja' | 'nee') : null;
  const filters: FactuurLijstFilters = {
    klant: klantId,
    van: periode.van,
    totExclusief: periode.totExclusief,
    vervallen: param(sp, 'vervallen') === '1',
    bedragMin: bedrag.min,
    bedragMax: bedrag.max,
    gemaild: gemaildFilter,
    boekhouding: (['doorgezet', 'niet', 'fout'] as const).find((w) => w === param(sp, 'boekhouding')) ?? null,
  };

  const [{ rijen: facturen, totaal }, organisaties, factureerbaar, boekhouderEmail, perStatus, klantNaam, admin] = await Promise.all([
    listFacturenPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek: zoekTerm, status, sort, dir: richting, filters }),
    listOrganisaties(),
    listFactureerbareOrders(),
    getBoekhouderEmail(),
    telPerStatus('facturen'),
    klantLabel(klantId),
    getHuidigeAdmin(),
  ]);
  const voorgeselecteerd = order && factureerbaar.some((o) => o.id === order) ? order : '';
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const alleFacturen = Object.values(perStatus).reduce((n, a) => n + a, 0);

  // `gemaild` is al de melding na het mailen (?gemaild=3); het filter heet daarom gemaild_filter.
  const filterDefs: FilterDef[] = [
    { soort: 'zoek', param: 'klant', label: 'Klant', hoofd: true, zoek: zoekKlantenVoorFilter, huidigLabel: klantNaam, placeholder: 'Alle klanten' },
    { soort: 'datum', param: 'datum', label: 'Factuurdatum', hoofd: true },
    { soort: 'aanuit', param: 'vervallen', label: 'Alleen vervallen', chipLabel: 'Vervallen en niet betaald', hoofd: true },
    { soort: 'bedrag', param: 'bedrag', label: 'Bedrag incl. btw' },
    {
      soort: 'select',
      param: 'gemaild_filter',
      label: 'Boekhouder',
      opties: [
        { waarde: 'ja', label: 'Al gemaild' },
        { waarde: 'nee', label: 'Nog niet gemaild' },
      ],
    },
    {
      soort: 'select',
      param: 'boekhouding',
      label: 'Boekhouding',
      opties: [
        { waarde: 'doorgezet', label: 'In Moneybird' },
        { waarde: 'niet', label: 'Nog niet doorgezet' },
        { waarde: 'fout', label: 'Fout bij doorzetten' },
      ],
    },
  ];
  const moneybird = isMoneybirdGeconfigureerd();
  const exportPeriode = vorigKwartaal();
  const filterActief = filterDefs.some((d) => sleutelsVan(d).some((k) => param(sp, k))) || Boolean(status || zoekTerm);
  const basis = '/dashboard/facturen';
  const vandaag = new Date().toISOString().slice(0, 10);
  // Filters, zoekterm en sortering reizen mee met bladeren.
  const urlMet = (wijzig: Record<string, string | number | null>) => lijstUrl(basis, sp, wijzig);
  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="dash-h1">Facturen</h1>
          <span className="text-[13px] tabular-nums text-warm">{filterActief ? `${totaal} van ${alleFacturen}` : alleFacturen}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Factuur van order"
            titel="Factuur van order"
            beschrijving="Kies een order zonder factuur. De orderregels worden overgenomen als factuurregels."
            >
            {factureerbaar.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-xs text-warm">Geen orders zonder factuur beschikbaar.</p>
          ) : (
            <form action={factuurVanOrder} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="veld-label">Order</label>
                <select name="order_id" required defaultValue={voorgeselecteerd} className={inputCls}>
                  <option value="">Kies een order</option>
                  {factureerbaar.map((o) => (
                    <option key={o.id} value={o.id}>#{o.ordernummer}{o.organisatie_naam ? ` · ${o.organisatie_naam}` : ''}{o.bedrag != null ? ` · ${euro(Number(o.bedrag))}` : ''}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="self-start knop-donker">Factuur aanmaken</button>
            </form>
          )}
          {factureerbaar.length > 1 && (
            <form action={factureerAlleActie} className="mt-3 border-t border-line pt-3">
              <button type="submit" className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">Factureer alle {factureerbaar.length} orders in een keer</button>
            </form>
          )}
          </Drawer>
          <Drawer
            knop="Lege factuur"
            titel="Lege factuur"
            beschrijving="Kies een klant en vul daarna zelf de regels in."
            >
            <form action={legeFactuur} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="veld-label">Klant</label>
                <select name="organisatie_id" required className={inputCls}>
                  <option value="">Kies een klant</option>
                  {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
                </select>
              </div>
              <button type="submit" className="self-start knop-donker">Lege factuur aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Alle facturen met hun status. Klik op een factuurnummer om de regels te beheren en de factuur af te drukken.</p>

      {gemaild && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">{gemaild} {Number(gemaild) === 1 ? 'factuur' : 'facturen'} gemaild naar de boekhouder.</p>
      )}
      {mailfout && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">{mailfout}</p>
      )}
      {bkok && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">{bkok}</p>
      )}
      {ok === 'boekhouder' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">E-mailadres van de boekhouder opgeslagen.</p>
      )}
      {ok === 'bulk' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">{Number(aantal) || 0} factuur(en) aangemaakt uit afgeronde orders.</p>
      )}

      <div className="mt-6 panel p-4">
        <h2 className="font-display text-lg font-bold text-ink-900">Boekhouder</h2>
        <p className="mt-1 text-xs text-warm">Facturen worden naar dit adres gemaild.</p>
        <form action={zetBoekhouderEmailActie} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="veld-label">E-mailadres boekhouder</label>
            <input type="email" name="boekhouder_email" defaultValue={boekhouderEmail} placeholder="boekhouder@voorbeeld.nl" className={inputCls} />
          </div>
          <button type="submit" className="knop-donker">Opslaan</button>
        </form>
      </div>

      <div className="mt-4 panel p-4">
        <h2 className="font-display text-lg font-bold text-ink-900">Exporteren voor de boekhouding</h2>
        <p className="mt-1 text-xs text-warm">
          Alle definitieve facturen (geen concepten) met een factuurdatum in de gekozen periode. De CSV opent direct in Excel; de ZIP bevat per factuur een UBL-bestand dat Exact Online, e-Boekhouden, Snelstart en de accountant kunnen inlezen.
        </p>
        <form action="/dashboard/facturen/export" method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="export-van" className="veld-label">Van</label>
            <input id="export-van" type="date" name="van" required defaultValue={exportPeriode.van} className={inputCls} />
          </div>
          <div>
            <label htmlFor="export-tot" className="veld-label">Tot en met</label>
            <input id="export-tot" type="date" name="tot" required defaultValue={exportPeriode.tot} className={inputCls} />
          </div>
          <button type="submit" name="formaat" value="csv" className="knop-donker">CSV downloaden</button>
          <button type="submit" name="formaat" value="ubl" className="knop-stil">UBL-bestanden (ZIP)</button>
        </form>
        {!moneybird && (
          <p className="mt-3 text-xs text-warm">
            Werk je met Moneybird? Dan kun je facturen ook rechtstreeks doorzetten.{' '}
            <Link href="/dashboard/instellingen/boekhouding" className="font-semibold text-amber-700 hover:text-amber-800">Koppeling aanzetten</Link>
          </p>
        )}
      </div>

      <FilterBalk filters={filterDefs} opslag="facturen" gebruiker={admin?.email} wisOok={['status', 'zoek']}>
        <Zoekbalk placeholder="Zoek op klant of factuurnummer" />
      </FilterBalk>

      <StatusChips
        basePath={basis}
        huidig={status}
        statussen={FACTUUR_STATUSSEN}
        aantallen={perStatus}
        bewaar={bewaarParams(sp, ['status'])}
      />

        {facturen.length === 0 ? (
          <EmptyState tekst={filterActief ? 'Geen facturen die aan deze filters voldoen. Haal een filter weg via het kruisje.' : 'Nog geen facturen. Maak er rechtsboven een aan.'} />
        ) : (
          <form action={mailFacturenActie}>
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <button type="submit" formAction={markeerBetaaldActie} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Markeer geselecteerde als betaald</button>
              {moneybird && (
                <button type="submit" formAction={bulkDoorzettenActie} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Doorzetten naar Moneybird</button>
              )}
              <button type="submit" className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Mail geselecteerde naar boekhouder</button>
            </div>
            <div className="panel">
              <table className="tbl">
                <thead className="thead-sticky">
                  <tr>
                    <th><span className="sr-only">Selecteren</span></th>
                    <SortableTh label="Nummer" col="factuurnummer" />
                    <th>Klant</th>
                    <SortableTh label="Datum" col="factuurdatum" className="hidden sm:table-cell" />
                    <SortableTh label="Vervaldatum" col="vervaldatum" className="hidden sm:table-cell" />
                    <SortableTh label="Bedrag incl." col="bedrag_incl" />
                    <SortableTh label="Status" col="status" />
                    <th className="hidden sm:table-cell">Boekhouder</th>
                    <th className="hidden md:table-cell">Boekhouding</th>
                  </tr>
                </thead>
                <tbody>
                  {facturen.map((f) => (
                    <tr key={f.id} className="border-b border-line">
                      <td>
                        <input type="checkbox" name="factuur_ids" value={f.id} className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" aria-label={`Selecteer factuur ${f.factuurnummer || 'concept'}`} />
                      </td>
                      <td>
                        <Link href={`/dashboard/facturen/${f.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{f.factuurnummer || 'concept'}</Link>
                      </td>
                      <td className="text-ink-900">{f.organisatie_naam || '-'}</td>
                      <td className="hidden whitespace-nowrap text-warm sm:table-cell">{fmt(f.factuurdatum)}</td>
                      <td className="hidden whitespace-nowrap text-warm sm:table-cell">
                        {fmt(f.vervaldatum)}
                        {f.status !== 'betaald' && f.vervaldatum && f.vervaldatum < vandaag && (
                          <span className="block text-[11px] font-semibold text-red-700">vervallen</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-warm">{f.bedrag_incl != null ? euro(Number(f.bedrag_incl)) : '-'}</td>
                      <td>
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[f.status] ?? 'bg-ink-100 text-ink-600'}`}>{f.status}</span>
                      </td>
                      <td className="hidden whitespace-nowrap sm:table-cell">
                        {f.gemaild_op ? (
                          <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Gemaild · {fmt(f.gemaild_op)}</span>
                        ) : (
                          <span className="text-xs text-warm">-</span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap md:table-cell">
                        {f.status === 'concept' ? <span className="text-xs text-warm">-</span> : <BoekhoudBadge factuur={f} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        )}
        {aantalPaginas > 1 && (
          <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
            {huidigePagina > 1 ? (
              <Link href={urlMet({ pagina: huidigePagina - 1 })} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
            ) : <span />}
            <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
            {huidigePagina < aantalPaginas ? (
              <Link href={urlMet({ pagina: huidigePagina + 1 })} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
            ) : <span />}
          </nav>
        )}
    </main>
  );
}
