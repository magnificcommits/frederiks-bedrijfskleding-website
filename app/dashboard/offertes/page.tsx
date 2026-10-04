import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import StatusChips from '@/components/dashboard/StatusChips';
import Zoekbalk from '@/components/dashboard/Zoekbalk';
import FilterBalk from '@/components/dashboard/FilterBalk';
import { telPerStatus } from '@/lib/kms/tellingen';
import { listOffertesPaged, OFFERTE_STATUSSEN, type OfferteLijstFilters } from '@/lib/kms/offertes';
import { klantLabel, offerteContactLabel } from '@/lib/kms/filterOpties';
import { zoekKlantenVoorFilter, zoekOfferteContactenVoorFilter } from '@/lib/kms/filterActies';
import { bedragParam, bewaarParams, isUuid, lijstUrl, param, periodeParam, sleutelsVan, vandaagPlus, type FilterDef } from '@/lib/filterBalk';
import { formatEuro, formatDatum } from '@/lib/format';
import SortableTh from '@/components/dashboard/SortableTh';
import ActieKnopMobiel from '@/components/dashboard/ui/ActieKnopMobiel';
import EmptyState from '@/components/dashboard/EmptyState';
import { bulkOfferteStatusActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offertes', robots: { index: false, follow: false } };

const PER_PAGINA = 25;

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verstuurd: 'bg-amber-100 text-amber-800',
  geaccepteerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-red-100 text-red-800',
};

/** Dagen tot geldig_tot (negatief = verlopen). */
function dagenTot(d: string | null): number | null {
  if (!d) return null;
  const vandaag = new Date(`${vandaagPlus(0)}T00:00:00Z`).getTime();
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isNaN(t) ? null : Math.round((t - vandaag) / 86_400_000);
}

export default async function OffertesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
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
  const sort = param(sp, 'sort') || undefined;
  const zoekTerm = param(sp, 'zoek');
  const huidigePagina = Math.max(1, Number(param(sp, 'pagina')) || 1);
  const richting = param(sp, 'dir') === 'asc' ? 'asc' : 'desc';

  const klantId = isUuid(param(sp, 'klant')) ? param(sp, 'klant') : null;
  const periode = periodeParam(sp, 'datum');
  const bedrag = bedragParam(sp, 'bedrag');
  const verloopt = (['7', '30', 'verlopen'] as const).find((v) => v === param(sp, 'verloopt')) ?? null;
  const contact = param(sp, 'contact');
  const filters: OfferteLijstFilters = {
    klant: klantId,
    van: periode.van,
    totExclusief: periode.totExclusief,
    bedragMin: bedrag.min,
    bedragMax: bedrag.max,
    verloopt,
    contact: contact || null,
  };

  const [{ rijen: offertes, totaal }, perStatus, klantNaam, contactNaam, admin] = await Promise.all([
    listOffertesPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek: zoekTerm, status, sort, dir: richting, filters }),
    telPerStatus('offertes'),
    klantLabel(klantId),
    contact ? offerteContactLabel(contact) : Promise.resolve(null),
    getHuidigeAdmin(),
  ]);
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const alleOffertes = Object.values(perStatus).reduce((n, a) => n + a, 0);

  const filterDefs: FilterDef[] = [
    { soort: 'zoek', param: 'klant', label: 'Klant', hoofd: true, zoek: zoekKlantenVoorFilter, huidigLabel: klantNaam, placeholder: 'Alle klanten' },
    { soort: 'datum', param: 'datum', label: 'Gemaakt' },
    {
      soort: 'select',
      param: 'verloopt',
      label: 'Geldigheid',
      hoofd: true,
      leegLabel: 'Alle',
      opties: [
        { waarde: '7', label: 'Verloopt binnen 7 dagen' },
        { waarde: '30', label: 'Verloopt binnen 30 dagen' },
        { waarde: 'verlopen', label: 'Verlopen, nog open' },
      ],
    },
    {
      soort: 'zoek',
      param: 'contact',
      label: 'Contactpersoon',
      zoek: zoekOfferteContactenVoorFilter,
      huidigLabel: contactNaam,
      placeholder: klantId ? 'Kies een contactpersoon' : 'Typ een naam',
      hint: klantId ? 'Deze klant heeft nog geen contactpersonen.' : 'Typ minstens 2 letters, of kies eerst een klant.',
    },
    { soort: 'bedrag', param: 'bedrag', label: 'Totaal incl. btw' },
  ];
  const filterActief = filterDefs.some((d) => sleutelsVan(d).some((k) => param(sp, k))) || Boolean(status || zoekTerm);

  const basis = '/dashboard/offertes';
  const urlMet = (wijzig: Record<string, string | number | null>) => lijstUrl(basis, sp, wijzig);
  // URL van de huidige weergave: na een bulk-statuswijziging keren we hier terug
  // zodat filters, sortering en pagina behouden blijven.
  const huidigeUrl = urlMet({ pagina: huidigePagina });

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="dash-h1">Offertes</h1>
          <span className="text-[13px] tabular-nums text-warm">{filterActief ? `${totaal} van ${alleOffertes}` : alleOffertes}</span>
        </div>
        <Link href="/dashboard/offertes/nieuw" className="knop-primair max-md:hidden">Nieuwe offerte</Link>
      </div>

      <FilterBalk filters={filterDefs} opslag="offertes" gebruiker={admin?.email} wisOok={['status', 'zoek']}>
        <Zoekbalk placeholder="Zoek op klant, plaats, contactpersoon of nummer" />
      </FilterBalk>

      <StatusChips
        basePath={basis}
        huidig={status}
        statussen={OFFERTE_STATUSSEN}
        aantallen={perStatus}
        bewaar={bewaarParams(sp, ['status'])}
      />

      {offertes.length === 0 ? (
        filterActief ? (
          <EmptyState
            className="mt-4"
            soort="gefilterd"
            titel="Geen offertes gevonden"
            tekst="Geen offerte past bij deze zoekterm of filters. Haal een filter weg via het kruisje."
            actieHref="/dashboard/offertes"
            actieLabel="Alle offertes tonen"
          />
        ) : (
          <EmptyState
            className="mt-4"
            titel="Nog geen offertes"
            tekst="Een offerte stel je samen uit je producten, met logo’s en aantallen per maat. Stuurt de klant akkoord, dan wordt het met één klik een order."
            actieHref="/dashboard/offertes/nieuw"
            actieLabel="Maak je eerste offerte"
          />
        )
      ) : (
        <>
          <form id="bulkoffertes" action={bulkOfferteStatusActie} className="mb-3 flex flex-wrap items-center justify-end gap-2 max-md:hidden">
            <input type="hidden" name="terug" value={huidigeUrl} />
            <span className="text-[12px] text-warm">Status van geselecteerde:</span>
            {/* Lege beginwaarde: een misklik op Toepassen zet dan niet alles terug op concept. */}
            <select name="bulk_status" defaultValue="" aria-label="Nieuwe status voor geselecteerde offertes" className="veld w-48">
              <option value="">Kies een status</option>
              {OFFERTE_STATUSSEN.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="knop-stil">Toepassen</button>
          </form>
          <div className="panel">
            <table className="tbl tbl-kaart">
              <thead className="thead-sticky">
                <tr>
                  <th><span className="sr-only">Selecteren</span></th>
                  <SortableTh label="Nummer" col="offertenummer" />
                  <th>Klant</th>
                  <SortableTh label="Datum" col="created_at" className="hidden sm:table-cell" />
                  <SortableTh label="Geldig tot" col="geldig_tot" className="hidden sm:table-cell" />
                  <SortableTh label="Status" col="status" />
                  <th className="text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {offertes.map((o) => {
                  const dagen = dagenTot(o.geldig_tot);
                  const open = o.status === 'concept' || o.status === 'verstuurd';
                  return (
                    <tr key={o.id}>
                      <td className="kaart-verberg">
                        <input type="checkbox" name="offerte_ids" value={o.id} form="bulkoffertes" className="h-3.5 w-3.5 rounded border-line text-amber-600 focus:ring-amber-200" aria-label={`Selecteer offerte ${o.offertenummer != null ? `#${o.offertenummer}` : 'concept'}`} />
                      </td>
                      <td className="kaart-kop">
                        <Link href={`/dashboard/offertes/${o.id}`} className="rij-link tabular-nums">
                          {o.offertenummer != null ? `#${o.offertenummer}` : 'concept'}
                          <span className="font-normal text-ink-800 md:hidden"> · {o.organisatie_naam || 'Geen klant'}</span>
                        </Link>
                      </td>
                      <td className="kaart-verberg">
                        {o.organisatie_naam || '-'}
                        {o.contactpersoon && <span className="block text-[11px] text-warm">{o.contactpersoon}</span>}
                      </td>
                      <td className="stil hidden whitespace-nowrap sm:table-cell kaart-verberg" data-label="Datum">{formatDatum(o.created_at) || '-'}</td>
                      <td className="stil hidden whitespace-nowrap sm:table-cell" data-label="Geldig tot">
                        {formatDatum(o.geldig_tot) || '-'}
                        {open && dagen != null && dagen < 0 && <span className="block text-[11px] font-semibold text-red-700">verlopen</span>}
                        {open && dagen != null && dagen >= 0 && dagen <= 7 && (
                          <span className="block text-[11px] font-semibold text-amber-800">{dagen === 0 ? 'verloopt vandaag' : `nog ${dagen} ${dagen === 1 ? 'dag' : 'dagen'}`}</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${statusBadge[o.status] ?? 'bg-ink-100 text-ink-600'}`}>{o.status}</span>
                      </td>
                      <td className="num" data-label="Totaal">{formatEuro(o.totaal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {aantalPaginas > 1 && (
        <nav className="mt-3 flex items-center justify-between gap-4 text-[13px]" aria-label="Paginering">
          {huidigePagina > 1 ? (
            <Link href={urlMet({ pagina: huidigePagina - 1 })} className="knop-stil">Vorige</Link>
          ) : <span />}
          <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
          {huidigePagina < aantalPaginas ? (
            <Link href={urlMet({ pagina: huidigePagina + 1 })} className="knop-stil">Volgende</Link>
          ) : <span />}
        </nav>
      )}

      <ActieKnopMobiel href="/dashboard/offertes/nieuw" label="Nieuwe offerte" />
    </main>
  );
}
