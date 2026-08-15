import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrdersPaged, ORDER_STATUSSEN } from '@/lib/kms/orders';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import SortableTh from '@/components/dashboard/SortableTh';
import Drawer from '@/components/dashboard/Drawer';
import Zoekbalk from '@/components/dashboard/Zoekbalk';
import { nieuweOrder, wijzigOrderStatusInline, bulkOrderStatusActie } from './actions';

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

/**
 * Aantal orders per status, voor de tellers op de filterchips.
 * Eén query over één kolom. Boven ~20.000 orders is een database-functie
 * met GROUP BY zuiniger dan alle statussen ophalen.
 */
async function ordersPerStatus(): Promise<Record<string, number>> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const { data } = await sb.from('orders').select('status');
  const map: Record<string, number> = {};
  ((data as { status: string | null }[]) ?? []).forEach((r) => {
    if (r.status) map[r.status] = (map[r.status] ?? 0) + 1;
  });
  return map;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pagina?: string; sort?: string; dir?: string; zoek?: string }>;
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

  const { status, pagina, sort, dir, zoek } = await searchParams;
  const zoekTerm = (zoek ?? '').trim();
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const richting: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
  const huidigeStatus = (status ?? '').trim();

  const [{ rijen: orders, totaal }, { data: orgData }, { data: medewData }, perStatus] = await Promise.all([
    listOrdersPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek: zoekTerm, status: huidigeStatus, sort, dir: richting }),
    sb.from('organisaties').select('id, naam').order('naam'),
    sb.from('medewerkers').select('id, naam').order('naam'),
    ordersPerStatus(),
  ]);
  const organisaties = (orgData as { id: string; naam: string }[]) ?? [];
  const medewerkers = (medewData as { id: string; naam: string }[]) ?? [];
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const alleOrders = Object.values(perStatus).reduce((n, a) => n + a, 0);

  const sortQs = sort ? `&sort=${encodeURIComponent(sort)}&dir=${richting}` : '';
  const statusQs = huidigeStatus ? `&status=${encodeURIComponent(huidigeStatus)}` : '';
  // URL van de huidige weergave: na een inline statuswijziging keren we hier terug
  // zodat statusfilter, sortering en pagina behouden blijven.
  const huidigeUrl = `/dashboard/orders?pagina=${huidigePagina}${statusQs}${sortQs}`;

  function statusUrl(s: string) {
    const p = new URLSearchParams();
    if (s) p.set('status', s);
    if (sort) { p.set('sort', sort); p.set('dir', richting); }
    const qs = p.toString();
    return qs ? `/dashboard/orders?${qs}` : '/dashboard/orders';
  }

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="dash-h1">Orders</h1>
          <span className="text-[13px] tabular-nums text-warm">
            {huidigeStatus ? `${totaal} van ${alleOrders}` : alleOrders}
          </span>
        </div>
        <Drawer
          knop="Nieuwe order"
          titel="Nieuwe order"
          beschrijving="Kies de klant en eventueel de medewerker. Na opslaan ga je door naar de orderpagina voor de regels."
        >
          <form action={nieuweOrder} className="flex flex-col gap-3">
            <div>
              <label className="veld-label" htmlFor="o-klant">Klant</label>
              <select id="o-klant" name="organisatie_id" required className="veld">
                <option value="">Kies een klant</option>
                {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="veld-label" htmlFor="o-medew">Medewerker (optioneel)</label>
              <select id="o-medew" name="medewerker_id" className="veld">
                <option value="">Geen medewerker</option>
                {medewerkers.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="veld-label" htmlFor="o-aanvrager">Aangevraagd door (optioneel)</label>
              <input id="o-aanvrager" name="aangevraagd_door" placeholder="Naam" className="veld" />
            </div>
            <button type="submit" className="knop-primair mt-2 self-start">Order aanmaken</button>
          </form>
        </Drawer>
      </div>

      <div className="dash-filter flex flex-wrap items-center gap-3">
        <Zoekbalk waarde={zoekTerm} placeholder="Zoek op klant of ordernummer" bewaar={{ status: huidigeStatus }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Link href={statusUrl('')} className={`chip ${huidigeStatus ? '' : 'chip-aan'}`}>
          Alle
          <span className="chip-tel">{alleOrders}</span>
        </Link>
        {ORDER_STATUSSEN.map((s) => {
          const aantal = perStatus[s] ?? 0;
          return (
            <Link key={s} href={statusUrl(s)} className={`chip ${huidigeStatus === s ? 'chip-aan' : ''}`}>
              {leesbaar(s)}
              <span className="chip-tel">{aantal}</span>
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <p className="panel mt-4 px-4 py-8 text-center text-[13px] text-warm">
          Geen orders{huidigeStatus ? ` met status “${leesbaar(huidigeStatus)}”` : ''}. Maak er rechtsboven een aan.
        </p>
      ) : (
        <>
          <form id="bulkorders" action={bulkOrderStatusActie} className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <input type="hidden" name="terug" value={huidigeUrl} />
            <span className="text-[12px] text-warm">Status van geselecteerde:</span>
            <select name="bulk_status" aria-label="Nieuwe status voor geselecteerde orders" className="veld w-52">
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
                    <td className="stil whitespace-nowrap">{fmt(o.besteldatum)}</td>
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
            <Link href={`/dashboard/orders?pagina=${huidigePagina - 1}${statusQs}${sortQs}`} className="knop-stil">Vorige</Link>
          ) : <span />}
          <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
          {huidigePagina < aantalPaginas ? (
            <Link href={`/dashboard/orders?pagina=${huidigePagina + 1}${statusQs}${sortQs}`} className="knop-stil">Volgende</Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
