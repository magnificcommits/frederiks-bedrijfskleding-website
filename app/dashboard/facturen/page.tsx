import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import StatusChips from '@/components/dashboard/StatusChips';
import Zoekbalk from '@/components/dashboard/Zoekbalk';
import { telPerStatus } from '@/lib/kms/tellingen';
import { listFacturenPaged, listOrganisaties, listFactureerbareOrders, getBoekhouderEmail, FACTUUR_STATUSSEN } from '@/lib/kms/facturen';
import SortableTh from '@/components/dashboard/SortableTh';
import EmptyState from '@/components/dashboard/EmptyState';
import { factuurVanOrder, legeFactuur, zetBoekhouderEmailActie, mailFacturenActie, factureerAlleActie, markeerBetaaldActie } from './actions';

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

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verzonden: 'bg-amber-100 text-amber-800',
  betaald: 'bg-green-100 text-green-800',
};

export default async function FacturenPage({ searchParams }: { searchParams: Promise<{ status?: string; order?: string; ok?: string; gemaild?: string; mailfout?: string; pagina?: string; sort?: string; dir?: string; aantal?: string; zoek?: string }> }) {
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

  const { status, order, ok, gemaild, mailfout, pagina, sort, dir, aantal, zoek } = await searchParams;
  const zoekTerm = (zoek ?? '').trim();
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const richting = dir === 'asc' ? 'asc' : 'desc';
  const [{ rijen: facturen, totaal }, organisaties, factureerbaar, boekhouderEmail] = await Promise.all([
    listFacturenPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek: zoekTerm, status, sort, dir: richting }),
    listOrganisaties(),
    listFactureerbareOrders(),
    getBoekhouderEmail(),
  ]);
  const voorgeselecteerd = order && factureerbaar.some((o) => o.id === order) ? order : '';
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const statusQs = status ? `&status=${encodeURIComponent(status)}` : '';
  const sorteerQs = `${sort ? `&sort=${encodeURIComponent(sort)}` : ''}${dir ? `&dir=${encodeURIComponent(richting)}` : ''}`;

  const perStatus = await telPerStatus('facturen');
  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Facturen</h1>
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

      <div className="dash-filter flex flex-wrap items-center gap-3">
        <Zoekbalk waarde={zoekTerm} placeholder="Zoek op klant of factuurnummer" bewaar={{ status }} />
      </div>

      <StatusChips
        basePath="/dashboard/facturen"
        huidig={status ?? ''}
        statussen={FACTUUR_STATUSSEN}
        aantallen={perStatus}
        bewaar={{ sort, dir: sort ? richting : undefined }}
      />

        {facturen.length === 0 ? (
          <EmptyState tekst="Geen facturen gevonden. Maak er rechtsboven een aan." />
        ) : (
          <form action={mailFacturenActie}>
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <button type="submit" formAction={markeerBetaaldActie} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Markeer geselecteerde als betaald</button>
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
                      <td className="hidden whitespace-nowrap text-warm sm:table-cell">{fmt(f.vervaldatum)}</td>
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
              <Link href={`/dashboard/facturen?pagina=${huidigePagina - 1}${statusQs}${sorteerQs}`} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
            ) : <span />}
            <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
            {huidigePagina < aantalPaginas ? (
              <Link href={`/dashboard/facturen?pagina=${huidigePagina + 1}${statusQs}${sorteerQs}`} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
            ) : <span />}
          </nav>
        )}
    </main>
  );
}
