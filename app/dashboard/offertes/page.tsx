import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import StatusChips from '@/components/dashboard/StatusChips';
import Zoekbalk from '@/components/dashboard/Zoekbalk';
import { telPerStatus } from '@/lib/kms/tellingen';
import { listOffertesPaged, OFFERTE_STATUSSEN } from '@/lib/kms/offertes';
import { listOrganisaties } from '@/lib/portaalAdmin';
import { formatEuro, formatDatum } from '@/lib/format';
import SortableTh from '@/components/dashboard/SortableTh';
import EmptyState from '@/components/dashboard/EmptyState';
import { maakOfferteActie, bulkOfferteStatusActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offertes', robots: { index: false, follow: false } };

const inputCls = 'veld';
const PER_PAGINA = 25;

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verstuurd: 'bg-amber-100 text-amber-800',
  geaccepteerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-red-100 text-red-800',
};

export default async function OffertesPage({ searchParams }: { searchParams: Promise<{ status?: string; pagina?: string; sort?: string; dir?: string; zoek?: string }> }) {
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
  const richting = dir === 'asc' ? 'asc' : 'desc';
  // Totaalbedrag per offerte komt nu in één query mee (geen N+1 meer per rij).
  const [{ rijen: offertes, totaal }, organisaties] = await Promise.all([
    listOffertesPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek: zoekTerm, status, sort, dir: richting }),
    listOrganisaties(),
  ]);
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const statusQs = status ? `&status=${encodeURIComponent(status)}` : '';
  const sorteerQs = `${sort ? `&sort=${encodeURIComponent(sort)}` : ''}${dir ? `&dir=${encodeURIComponent(richting)}` : ''}`;
  // URL van de huidige weergave: na een bulk-statuswijziging keren we hier terug
  // zodat statusfilter, sortering en pagina behouden blijven.
  const huidigeUrl = `/dashboard/offertes?pagina=${huidigePagina}${statusQs}${sorteerQs}`;

  const perStatus = await telPerStatus('offertes');
  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Offertes</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Nieuwe offerte"
            titel="Nieuwe offerte"
            beschrijving="Kies een klant en vul daarna de regels in op de offerte."
          >
            <form action={maakOfferteActie} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="veld-label">Klant</label>
                  <select name="organisatie_id" className={inputCls} defaultValue="">
                    <option value="">Geen klant gekoppeld</option>
                    {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="veld-label">Contactpersoon</label>
                  <input name="contactpersoon" placeholder="Naam contactpersoon" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Geldig tot</label>
                  <input type="date" name="geldig_tot" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Notitie</label>
                  <textarea name="notitie" rows={2} placeholder="Interne notitie of toelichting" className={inputCls} />
                </div>
                <button type="submit" className="self-start knop-donker">Offerte aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Offertes met hun status. Klik op een offertenummer om de regels te beheren en de offerte af te drukken.</p>

      <div className="dash-filter flex flex-wrap items-center gap-3">
        <Zoekbalk waarde={zoekTerm} placeholder="Zoek op klant of offertenummer" bewaar={{ status }} />
      </div>

      <StatusChips
        basePath="/dashboard/offertes"
        huidig={status ?? ''}
        statussen={OFFERTE_STATUSSEN}
        aantallen={perStatus}
        bewaar={{ sort, dir: sort ? richting : undefined }}
      />

        {offertes.length === 0 ? (
          <EmptyState tekst="Geen offertes gevonden. Maak er rechtsboven een aan." />
        ) : (
          <>
            <form id="bulkoffertes" action={bulkOfferteStatusActie} className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <input type="hidden" name="terug" value={huidigeUrl} />
              <span className="text-xs text-warm">Status van geselecteerde:</span>
              <select name="bulk_status" aria-label="Nieuwe status voor geselecteerde offertes" className="rounded-md border border-line px-2 py-1.5 text-xs font-semibold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                {OFFERTE_STATUSSEN.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">Toepassen</button>
            </form>
            <div className="panel">
            <table className="tbl">
              <thead className="thead-sticky">
                <tr>
                  <th><span className="sr-only">Selecteren</span></th>
                  <SortableTh label="Nummer" col="offertenummer" />
                  <th>Klant</th>
                  <SortableTh label="Datum" col="created_at" className="hidden sm:table-cell" />
                  <SortableTh label="Status" col="status" />
                  <th className="text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {offertes.map((o) => (
                  <tr key={o.id} className="border-b border-line">
                    <td>
                      <input type="checkbox" name="offerte_ids" value={o.id} form="bulkoffertes" className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" aria-label={`Selecteer offerte ${o.offertenummer != null ? `#${o.offertenummer}` : 'concept'}`} />
                    </td>
                    <td>
                      <Link href={`/dashboard/offertes/${o.id}`} className="font-semibold text-amber-700 hover:text-amber-800">
                        {o.offertenummer != null ? `#${o.offertenummer}` : 'concept'}
                      </Link>
                    </td>
                    <td className="text-ink-900">{o.organisatie_naam || '-'}</td>
                    <td className="hidden whitespace-nowrap text-warm sm:table-cell">{formatDatum(o.created_at) || '-'}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[o.status] ?? 'bg-ink-100 text-ink-600'}`}>{o.status}</span>
                    </td>
                    <td className="whitespace-nowrap text-right text-ink-900">{formatEuro(o.totaal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        {aantalPaginas > 1 && (
          <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
            {huidigePagina > 1 ? (
              <Link href={`/dashboard/offertes?pagina=${huidigePagina - 1}${statusQs}${sorteerQs}`} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
            ) : <span />}
            <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
            {huidigePagina < aantalPaginas ? (
              <Link href={`/dashboard/offertes?pagina=${huidigePagina + 1}${statusQs}${sorteerQs}`} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
            ) : <span />}
          </nav>
        )}
    </main>
  );
}
