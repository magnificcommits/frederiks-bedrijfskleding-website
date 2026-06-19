import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { listOrganisatiesPaged, type Organisatie } from '@/lib/portaalAdmin';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { nieuweOrganisatie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klanten', robots: { index: false, follow: false } };
const DASH_COOKIE = 'fb_dash';
const PER_PAGINA = 25;
const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/**
 * Eén pagina klanten met server-side zoekfilter op naam, plaats en contactpersoon.
 * `listOrganisatiesPaged` (lib/portaalAdmin) kent geen zoekparameter en mag in deze
 * opdracht niet gewijzigd worden, daarom draaien we hier — bij een zoekterm — een
 * gelijkwaardige gepagineerde + getelde query via de reeds beschikbare kmsAdmin-client.
 * Zonder zoekterm valt de pagina terug op de bestaande helper, zodat het gedrag
 * identiek blijft. Filteren en pagineren gebeuren beide server-side in de query.
 */
async function zoekOrganisatiesPaged(opts: { pagina: number; perPagina: number; zoek?: string }): Promise<{ rijen: Organisatie[]; totaal: number }> {
  const term = (opts.zoek ?? '').trim();
  if (!term) return listOrganisatiesPaged({ pagina: opts.pagina, perPagina: opts.perPagina });
  const sb = kmsAdmin();
  if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  // Escape PostgREST-tekens (% , ) die de or-filter zouden kunnen breken.
  const veilig = term.replace(/[%,()]/g, ' ');
  const patroon = `%${veilig}%`;
  const { data, count } = await sb
    .from('organisaties')
    .select('*', { count: 'exact' })
    .or(`naam.ilike.${patroon},plaats.ilike.${patroon},contactpersoon.ilike.${patroon}`)
    .order('naam')
    .range(from, to);
  return { rijen: (data as Organisatie[]) ?? [], totaal: count ?? 0 };
}

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

/** Aantal medewerkers per organisatie, in één query opgehaald en geteld. */
async function medewerkersPerOrg(): Promise<Record<string, number>> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const { data } = await sb.from('medewerkers').select('organisatie_id');
  const map: Record<string, number> = {};
  ((data as { organisatie_id: string | null }[]) ?? []).forEach((r) => {
    if (r.organisatie_id) map[r.organisatie_id] = (map[r.organisatie_id] ?? 0) + 1;
  });
  return map;
}

export default async function KlantenPage({ searchParams }: { searchParams: Promise<{ pagina?: string; zoek?: string }> }) {
  if (!(await authed())) redirect('/dashboard');

  if (!isLeadsDbConfigured) {
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

  const { pagina, zoek } = await searchParams;
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const { rijen: orgs, totaal } = await zoekOrganisatiesPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek });
  const aantalPerOrg = await medewerkersPerOrg();
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const zoekQs = zoek && zoek.trim() ? `&zoek=${encodeURIComponent(zoek.trim())}` : '';

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Klanten</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant zet je hier de kledinglijn op en handel je herbestellingen af.</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Zoeken</label>
          <input name="zoek" defaultValue={zoek ?? ''} placeholder="Naam, plaats of contactpersoon" className={inputCls} />
        </div>
        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Zoeken</button>
        {zoek && zoek.trim() && <Link href="/dashboard/klanten" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </form>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {orgs.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen klanten. Voeg er rechts een toe.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Naam</th>
                    <th className="px-4 py-3">Plaats</th>
                    <th className="px-4 py-3">Medewerkers</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Aangemaakt</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/klanten/${o.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{o.naam}</Link>
                      </td>
                      <td className="px-4 py-3 text-warm">{o.plaats || '-'}</td>
                      <td className="px-4 py-3 text-warm">{aantalPerOrg[o.id] ?? 0}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-warm sm:table-cell">{fmt(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aantalPaginas > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
              {huidigePagina > 1 ? (
                <Link href={`/dashboard/klanten?pagina=${huidigePagina - 1}${zoekQs}`} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
              ) : <span />}
              <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
              {huidigePagina < aantalPaginas ? (
                <Link href={`/dashboard/klanten?pagina=${huidigePagina + 1}${zoekQs}`} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
              ) : <span />}
            </nav>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe klant</h2>
          <p className="mt-1 text-xs text-warm">Vul direct de contactpersoon en het inlog-e-mailadres in, dan kan de klant meteen inloggen op het portaal. Na opslaan ga je door naar de klantpagina voor de kledinglijn.</p>
          <form action={nieuweOrganisatie} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Bedrijfsnaam</label>
              <input name="naam" required placeholder="Bedrijfsnaam" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Adres</label>
              <input name="adres" placeholder="Straat en huisnummer" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-warm">Postcode</label>
                <input name="postcode" placeholder="0000 AA" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Plaats</label>
                <input name="plaats" placeholder="Plaats" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Telefoon</label>
              <input name="telefoon" placeholder="06 12 34 56 78" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="mt-2 border-t border-line pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Contactpersoon (optioneel)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Naam contactpersoon</label>
              <input name="contactpersoon" placeholder="Voor- en achternaam" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Inlog-e-mail</label>
              <input name="email" type="email" placeholder="naam@bedrijf.nl" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <p className="mt-1 text-xs text-warm">Dit adres kan straks inloggen op /portaal via een e-maillink.</p>
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Klant aanmaken</button>
          </form>
        </div>
      </div>
    </main>
  );
}
