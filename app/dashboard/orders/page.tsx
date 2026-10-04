import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { listOrdersPaged, ORDER_STATUSSEN, GOEDKEURING_STATUSSEN, AFGEHANDELDE_ORDERSTATUSSEN, type OrderLijstFilters } from '@/lib/kms/orders';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import SortableTh from '@/components/dashboard/SortableTh';
import Zoekbalk from '@/components/dashboard/Zoekbalk';
import FilterBalk from '@/components/dashboard/FilterBalk';
import { wijzigOrderStatusInline, bulkOrderStatusActie } from './actions';
import { aanvragerLabel } from '@/lib/kms/personen';
import { klantLabel } from '@/lib/kms/filterOpties';
import { zoekAanvragersVoorFilter, zoekKlantenVoorFilter } from '@/lib/kms/filterActies';
import { bedragParam, isUuid, lijstUrl, param, periodeParam, sleutelsVan, type FilterDef } from '@/lib/filterBalk';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders', robots: { index: false, follow: false } };

const PER_PAGINA = 25;
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const leesbaar = (s: string) => s.replace(/_/g, ' ');

function fmt(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

// Kleur betekent iets: amber = er moet iets gebeuren, groen = klaar, grijs = rust.
const statusBadge: Record<string, string> = {
  concept: 'badge-rust',
  offerte_verstuurd: 'badge-actie',
  offerte_goedgekeurd: 'badge-actie',
  nog_bestellen: 'badge-actie',
  besteld: 'badge-rust',
  deellevering: 'badge-actie',
  compleet_geleverd: 'badge-klaar',
  afgerond: 'badge-klaar',
};
const goedkeurBadge: Record<string, string> = {
  niet_nodig: 'badge-rust',
  wacht: 'badge-actie',
  goedgekeurd: 'badge-klaar',
  afgewezen: 'badge-rust',
};

const okBoodschap: Record<string, string> = {
  status: 'Status bijgewerkt.',
};

const goedkeurLabel: Record<string, string> = {
  wacht: 'Wacht op goedkeuring',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  niet_nodig: 'Niet nodig',
};

/**
 * Aantal orders per status en per goedkeuring, voor de tellers op de chips en
 * in het goedkeuringsfilter. Eén query over twee kolommen. Boven ~20.000
 * orders is een database-functie met GROUP BY zuiniger.
 */
async function ordersPerStatus(): Promise<{ status: Record<string, number>; goedkeuring: Record<string, number> }> {
  const sb = kmsAdmin();
  if (!sb) return { status: {}, goedkeuring: {} };
  const { data } = await sb.from('orders').select('status, goedkeuring_status');
  const status: Record<string, number> = {};
  const goedkeuring: Record<string, number> = {};
  ((data as { status: string | null; goedkeuring_status: string | null }[]) ?? []).forEach((r) => {
    if (r.status) status[r.status] = (status[r.status] ?? 0) + 1;
    if (r.goedkeuring_status) goedkeuring[r.goedkeuring_status] = (goedkeuring[r.goedkeuring_status] ?? 0) + 1;
  });
  return { status, goedkeuring };
}

/** Aantal dagen sinds de besteldatum, voor de markering "loopt achter". */
function dagenGeleden(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const ok = param(sp, 'ok');
  const sort = param(sp, 'sort') || undefined;
  const huidigeAanvrager = param(sp, 'aanvrager');
  const zoekTerm = param(sp, 'zoek');
  const huidigePagina = Math.max(1, Number(param(sp, 'pagina')) || 1);
  const richting: 'asc' | 'desc' = param(sp, 'dir') === 'asc' ? 'asc' : 'desc';
  const huidigeStatus = param(sp, 'status');

  // Filters uit de URL. Onbekende waarden worden genegeerd in plaats van een lege lijst te geven.
  const klantId = isUuid(param(sp, 'klant')) ? param(sp, 'klant') : null;
  const periode = periodeParam(sp, 'datum');
  const bedrag = bedragParam(sp, 'bedrag');
  const goedkeuring = (GOEDKEURING_STATUSSEN as readonly string[]).includes(param(sp, 'goedkeuring')) ? param(sp, 'goedkeuring') : null;
  const bron = param(sp, 'bron') === 'portaal' || param(sp, 'bron') === 'handmatig' ? (param(sp, 'bron') as 'portaal' | 'handmatig') : null;
  const drukproef = param(sp, 'drukproef') === 'ja' || param(sp, 'drukproef') === 'nee' ? (param(sp, 'drukproef') as 'ja' | 'nee') : null;
  const ouderDan = Math.max(0, Math.min(365, Number(param(sp, 'ouder')) || 0)) || null;
  const fase = param(sp, 'fase') === 'open' || param(sp, 'fase') === 'klaar' ? (param(sp, 'fase') as 'open' | 'klaar') : null;
  const filters: OrderLijstFilters = {
    klant: klantId,
    van: periode.van,
    totExclusief: periode.totExclusief,
    bedragMin: bedrag.min,
    bedragMax: bedrag.max,
    goedkeuring,
    bron,
    drukproef,
    ouderDan,
    fase,
  };

  const [{ rijen: orders, totaal }, tellingen, klantNaam, aanvragerNaam, admin] = await Promise.all([
    listOrdersPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek: zoekTerm, status: huidigeStatus, sort, dir: richting, aanvrager: huidigeAanvrager, filters }),
    ordersPerStatus(),
    klantLabel(klantId),
    huidigeAanvrager ? aanvragerLabel(huidigeAanvrager) : Promise.resolve(null),
    getHuidigeAdmin(),
  ]);
  const perStatus = tellingen.status;
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const alleOrders = Object.values(perStatus).reduce((n, a) => n + a, 0);

  const filterDefs: FilterDef[] = [
    { soort: 'zoek', param: 'klant', label: 'Klant', hoofd: true, zoek: zoekKlantenVoorFilter, huidigLabel: klantNaam, placeholder: 'Alle klanten' },
    { soort: 'datum', param: 'datum', label: 'Besteld', hoofd: true },
    {
      soort: 'select',
      param: 'fase',
      label: 'Fase',
      leegLabel: 'Alle',
      opties: [
        { waarde: 'open', label: 'Open (nog niet geleverd)' },
        { waarde: 'klaar', label: 'Geleverd of afgerond' },
      ],
    },
    {
      soort: 'select',
      param: 'goedkeuring',
      label: 'Goedkeuring',
      leegLabel: 'Alle',
      opties: (['wacht', 'goedgekeurd', 'afgewezen', 'niet_nodig'] as const).map((g) => ({ waarde: g, label: goedkeurLabel[g], aantal: tellingen.goedkeuring[g] ?? 0 })),
    },
    {
      soort: 'zoek',
      param: 'aanvrager',
      label: 'Aangevraagd door',
      zoek: zoekAanvragersVoorFilter,
      huidigLabel: aanvragerNaam,
      placeholder: klantId ? 'Kies een persoon' : 'Typ een naam',
      hint: klantId ? 'Deze klant heeft nog geen orders met een aanvrager.' : 'Typ minstens 2 letters, of kies eerst een klant: dan zie je meteen wie daar bestelt.',
    },
    { soort: 'bedrag', param: 'bedrag', label: 'Bedrag' },
    {
      soort: 'select',
      param: 'bron',
      label: 'Binnengekomen via',
      opties: [
        { waarde: 'portaal', label: 'Klantportaal' },
        { waarde: 'handmatig', label: 'Handmatig ingevoerd' },
      ],
    },
    {
      soort: 'select',
      param: 'drukproef',
      label: 'Drukproef',
      opties: [
        { waarde: 'ja', label: 'Met drukproef' },
        { waarde: 'nee', label: 'Zonder drukproef' },
      ],
    },
    {
      soort: 'select',
      param: 'ouder',
      label: 'Loopt achter',
      leegLabel: 'Niet filteren',
      opties: [7, 14, 30, 60].map((d) => ({ waarde: String(d), label: `Open en ouder dan ${d} dagen` })),
    },
  ];
  const filterActief = filterDefs.some((d) => sleutelsVan(d).some((k) => param(sp, k))) || Boolean(huidigeStatus || zoekTerm);

  /**
   * Eén plek waar de URL van de lijst wordt opgebouwd. Zoekterm, filters en
   * sortering reizen altijd mee: bladeren of een status bijwerken mag je niet
   * uit je zoekresultaat schoppen.
   */
  const basis = '/dashboard/orders';
  const urlMet = (wijzig: Record<string, string | number | null>) => lijstUrl(basis, sp, wijzig);

  // Waar de statusformulieren na het opslaan naartoe terugkeren.
  const huidigeUrl = urlMet({ pagina: huidigePagina });
  const afgehandeld = new Set<string>(AFGEHANDELDE_ORDERSTATUSSEN);

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="dash-h1">Orders</h1>
          <span className="text-[13px] tabular-nums text-warm">
            {filterActief ? `${totaal} van ${alleOrders}` : alleOrders}
          </span>
        </div>
        {/* Een order aanmaken is de handeling van de dag en vraagt om ruimte:
            eigen pagina in plaats van een lade van 320 px. */}
        <Link href="/dashboard/orders/nieuw" className="knop-primair">Nieuwe order</Link>
      </div>

      {ok && okBoodschap[ok] && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-[13px] font-semibold text-green-800">
          {okBoodschap[ok]}
        </p>
      )}

      <FilterBalk filters={filterDefs} opslag="orders" gebruiker={admin?.email} wisOok={['status', 'zoek']}>
        <Zoekbalk placeholder="Zoek op klant, ordernummer of referentie" />
      </FilterBalk>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Link href={urlMet({ status: null })} className={`chip ${huidigeStatus ? '' : 'chip-aan'}`}>
          Alle
          <span className="chip-tel">{alleOrders}</span>
        </Link>
        {ORDER_STATUSSEN.map((s) => {
          const aantal = perStatus[s] ?? 0;
          return (
            <Link key={s} href={urlMet({ status: s })} className={`chip ${huidigeStatus === s ? 'chip-aan' : ''}`}>
              {leesbaar(s)}
              <span className="chip-tel">{aantal}</span>
            </Link>
          );
        })}
        {/* Goedkeuring is een eigen veld naast de status: een order kan op "concept"
            staan en wachten op de klant. Deze chip zet het filter goedkeuring=wacht. */}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        <Link
          href={urlMet({ goedkeuring: goedkeuring === 'wacht' ? null : 'wacht' })}
          className={`chip ${goedkeuring === 'wacht' ? 'chip-aan' : ''}`}
          title="Orders waarvan de klant de goedkeuring nog moet geven"
        >
          Wacht op goedkeuring
          <span className="chip-tel">{tellingen.goedkeuring.wacht ?? 0}</span>
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="panel mt-4 px-4 py-8 text-center text-[13px] text-warm">
          {zoekTerm
            ? `Geen orders gevonden voor “${zoekTerm}”${huidigeStatus ? ` met status “${leesbaar(huidigeStatus)}”` : ''}. Pas de zoekterm aan of kies een ander filter.`
            : filterActief
              ? 'Geen orders die aan deze filters voldoen. Haal een filter weg via het kruisje.'
              : 'Nog geen orders. Maak er rechtsboven een aan.'}
        </p>
      ) : (
        <>
          <form id="bulkorders" action={bulkOrderStatusActie} className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <input type="hidden" name="terug" value={huidigeUrl} />
            <span className="text-[12px] text-warm">Status van geselecteerde:</span>
            {/* Bewust een lege beginwaarde: anders zet een misklik op Toepassen
                alle aangevinkte orders terug op concept. */}
            <select name="bulk_status" defaultValue="" aria-label="Nieuwe status voor geselecteerde orders" className="veld w-52">
              <option value="">Kies een status</option>
              {ORDER_STATUSSEN.map((s) => <option key={s} value={s}>{leesbaar(s)}</option>)}
            </select>
            <button type="submit" className="knop-stil">Toepassen</button>
          </form>

          <div className="panel mt-2">
            <table className="tbl">
              <thead className="thead-sticky-filter">
                <tr>
                  <th className="w-8"><span className="sr-only">Selecteren</span></th>
                  <SortableTh label="Nr." col="ordernummer" />
                  <th>Klant</th>
                  <th>Referentie</th>
                  <SortableTh label="Datum" col="besteldatum" />
                  <SortableTh label="Status" col="status" />
                  <SortableTh label="Bedrag" col="bedrag" className="num" />
                  <SortableTh label="Goedkeuring" col="goedkeuring_status" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="checkbox"
                        name="order_ids"
                        value={o.id}
                        form="bulkorders"
                        className="h-3.5 w-3.5 rounded border-line text-amber-600 focus:ring-amber-200"
                        aria-label={`Selecteer order #${o.ordernummer}`}
                      />
                    </td>
                    <td>
                      <Link href={`/dashboard/orders/${o.id}`} className="rij-link tabular-nums">#{o.ordernummer}</Link>
                    </td>
                    <td>
                      {o.organisatie_naam || '—'}
                      {o.medewerker_naam && <span className="block text-[11px] text-warm">{o.medewerker_naam}</span>}
                    </td>
                    <td className="stil">{o.referentienr || o.aangevraagd_door || '—'}</td>
                    <td className="stil whitespace-nowrap">
                      {fmt(o.besteldatum)}
                      {(() => {
                        const dagen = dagenGeleden(o.besteldatum);
                        return dagen != null && dagen > 14 && !afgehandeld.has(o.status) ? (
                          <span className="block text-[11px] font-semibold text-amber-800" title="Nog niet geleverd">{dagen} dagen open</span>
                        ) : null;
                      })()}
                    </td>
                    <td>
                      <form action={wijzigOrderStatusInline} className="flex items-center" data-statusform>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="terug" value={huidigeUrl} />
                        <AutoSubmitSelect
                          name="status"
                          defaultValue={o.status}
                          aria-label={`Status van order #${o.ordernummer}`}
                          className={`rounded border-0 py-0.5 pl-1.5 pr-6 text-[11px] font-semibold focus:ring-2 focus:ring-amber-300 ${statusBadge[o.status] === 'badge-klaar' ? 'bg-green-100 text-green-800' : statusBadge[o.status] === 'badge-actie' ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-600'}`}
                          options={ORDER_STATUSSEN.map((s) => ({ value: s, label: leesbaar(s) }))}
                        />
                      </form>
                    </td>
                    <td className="num">{o.bedrag != null ? euro(Number(o.bedrag)) : '—'}</td>
                    <td>
                      <span className={goedkeurBadge[o.goedkeuring_status] ?? 'badge-rust'}>
                        {leesbaar(o.goedkeuring_status)}
                      </span>
                    </td>
                  </tr>
                ))}
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
    </main>
  );
}
