import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listProspectenPaged, PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import SortableTh from '@/components/dashboard/SortableTh';
import EmptyState from '@/components/dashboard/EmptyState';
import { importeerCsvActie, nieuweProspectActie, zetProspectStatusActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prospects', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const PER_PAGINA = 25;
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const statusBadge: Record<string, string> = {
  nieuw: 'bg-ink-100 text-ink-600',
  benaderd: 'bg-amber-100 text-amber-800',
  reageerde: 'bg-amber-100 text-amber-800',
  gekwalificeerd: 'bg-amber-100 text-amber-800',
  klant: 'bg-green-100 text-green-800',
  afgemeld: 'bg-ink-100 text-ink-500',
};

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ status?: string; zoek?: string; pagina?: string; sort?: string; dir?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { status, zoek, pagina, sort, dir } = await searchParams;
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const richting: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
  const { rijen: prospecten, totaal } = await listProspectenPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, status, zoek, sort, dir: richting });
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const statusQs = status ? `&status=${encodeURIComponent(status)}` : '';
  const zoekQs = zoek ? `&zoek=${encodeURIComponent(zoek)}` : '';
  const sortQs = sort ? `&sort=${encodeURIComponent(sort)}&dir=${richting}` : '';
  // URL van de huidige weergave: na een inline statuswijziging keren we hier terug
  // zodat status-, zoekfilter, sortering en pagina behouden blijven.
  const huidigeUrl = `/dashboard/prospects?pagina=${huidigePagina}${statusQs}${zoekQs}${sortQs}`;

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Prospects</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Bedrijven die je wilt benaderen. Filter op status, zoek op naam of plaats, en houd per rij bij hoe ver je staat.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Status</label>
          <NavigateSelect
            basePath="/dashboard/prospects"
            param="status"
            value={status ?? ''}
            placeholder="Alle statussen"
            className={inputCls}
            options={PROSPECT_STATUSSEN.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <form method="get" className="grow">
          {status && <input type="hidden" name="status" value={status} />}
          <label className="block text-xs font-semibold text-warm">Zoeken</label>
          <input name="zoek" defaultValue={zoek ?? ''} placeholder="Bedrijf, contactpersoon, e-mail of plaats" className={`${inputCls} min-w-[16rem]`} />
        </form>
        {(status || zoek) && <Link href="/dashboard/prospects" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {prospecten.length === 0 ? (
            <EmptyState tekst="Geen prospects gevonden. Importeer er rechts een lijst of voeg er handmatig een toe." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <SortableTh label="Bedrijf" col="bedrijfsnaam" />
                    <SortableTh label="Plaats" col="plaats" />
                    <SortableTh label="Status" col="status" />
                    <SortableTh label="Toegevoegd" col="created_at" className="hidden sm:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {prospecten.map((p) => (
                    <tr key={p.id} className="border-b border-line">
                      <td className="px-4 py-3 text-ink-900">
                        <Link href={`/dashboard/prospects/${p.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{p.bedrijfsnaam}</Link>
                        {(p.eigenaar || p.contactpersoon) && <span className="block text-xs text-warm">{p.eigenaar || p.contactpersoon}</span>}
                        {p.email && <span className="block text-xs text-warm">{p.email}</span>}
                      </td>
                      <td className="px-4 py-3 text-warm">{p.plaats || '-'}</td>
                      <td className="px-4 py-3">
                        <form action={zetProspectStatusActie} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="terug" value={huidigeUrl} />
                          <AutoSubmitSelect
                            name="status"
                            defaultValue={p.status}
                            aria-label="Status"
                            className={`rounded-md border border-line px-2 py-1 text-xs font-semibold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 ${statusBadge[p.status] ?? 'bg-ink-100 text-ink-600'}`}
                            options={PROSPECT_STATUSSEN.map((s) => ({ value: s, label: s }))}
                          />
                        </form>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-warm sm:table-cell">{fmt(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aantalPaginas > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
              {huidigePagina > 1 ? (
                <Link href={`/dashboard/prospects?pagina=${huidigePagina - 1}${statusQs}${zoekQs}${sortQs}`} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
              ) : <span />}
              <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
              {huidigePagina < aantalPaginas ? (
                <Link href={`/dashboard/prospects?pagina=${huidigePagina + 1}${statusQs}${zoekQs}${sortQs}`} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
              ) : <span />}
            </nav>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Importeer prospects</h2>
            <p className="mt-1 text-xs text-warm">Plak een lijst, één bedrijf per regel, kommagescheiden. Volgorde: bedrijfsnaam, contactpersoon, email, telefoon, branche, plaats, website, grootte. Een koprij wordt automatisch overgeslagen. Rijen zonder bedrijfsnaam slaan we over.</p>
            <form action={importeerCsvActie} className="mt-4 flex flex-col gap-3">
              <textarea
                name="csv"
                rows={6}
                placeholder="bedrijfsnaam, contactpersoon, email, telefoon, branche, plaats"
                className={`${inputCls} font-mono text-xs`}
              />
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Importeren</button>
            </form>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe prospect</h2>
            <p className="mt-1 text-xs text-warm">Eén bedrijf toevoegen. Alleen de bedrijfsnaam is verplicht.</p>
            <form action={nieuweProspectActie} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm">Bedrijfsnaam</label>
                <input name="bedrijfsnaam" required placeholder="Bedrijfsnaam" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Contactpersoon (optioneel)</label>
                <input name="contactpersoon" placeholder="Naam" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">E-mail (optioneel)</label>
                  <input name="email" type="email" placeholder="naam@bedrijf.nl" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Telefoon (optioneel)</label>
                  <input name="telefoon" placeholder="06 12345678" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">Branche (optioneel)</label>
                  <input name="branche" placeholder="Bijv. installatie" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Plaats (optioneel)</label>
                  <input name="plaats" placeholder="Bijv. Doetinchem" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">Website (optioneel)</label>
                  <input name="website" placeholder="www.bedrijf.nl" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Grootte (optioneel)</label>
                  <input name="grootte" placeholder="Bijv. 10-25" className={inputCls} />
                </div>
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Prospect aanmaken</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
