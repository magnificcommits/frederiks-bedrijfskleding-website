import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listProspectenPaged, PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import SortableTh from '@/components/dashboard/SortableTh';
import EmptyState from '@/components/dashboard/EmptyState';
import { importeerCsvActie, nieuweProspectActie, zetProspectStatusActie, bulkLogosOphalenActie } from './actions';
import VerzendKnop from '@/components/dashboard/VerzendKnop';

export const dynamic = 'force-dynamic';
// De bulkactie "Logo's ophalen" loopt tot ~50 seconden.
export const maxDuration = 60;
export const metadata = { title: 'Prospects', robots: { index: false, follow: false } };

const inputCls = 'veld';
const PER_PAGINA = 25;
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const statusBadge: Record<string, string> = {
  nieuw: 'bg-ink-100 text-ink-600',
  benaderd: 'bg-amber-100 text-amber-800',
  geinteresseerd: 'bg-amber-200 text-amber-900',
  reageerde: 'bg-amber-100 text-amber-800',
  gekwalificeerd: 'bg-amber-100 text-amber-800',
  klant: 'bg-green-100 text-green-800',
  afgemeld: 'bg-ink-100 text-ink-500',
};

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ status?: string; zoek?: string; pagina?: string; sort?: string; dir?: string; gescand?: string; melding?: string; gelukt?: string; mislukt?: string; over?: string; rest?: string }> }) {
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

  const { status, zoek, pagina, sort, dir, gescand: gescandRuw, melding, gelukt, mislukt, over, rest } = await searchParams;
  const gescand = gescandRuw === 'ja' || gescandRuw === 'nee' ? gescandRuw : undefined;
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const richting: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
  const { rijen: prospecten, totaal } = await listProspectenPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, status, zoek, sort, dir: richting, gescand });
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const statusQs = status ? `&status=${encodeURIComponent(status)}` : '';
  const zoekQs = zoek ? `&zoek=${encodeURIComponent(zoek)}` : '';
  const sortQs = sort ? `&sort=${encodeURIComponent(sort)}&dir=${richting}` : '';
  const scanQs = gescand ? `&gescand=${gescand}` : '';
  // URL van de huidige weergave: na een inline statuswijziging keren we hier terug
  // zodat status-, zoekfilter, sortering en pagina behouden blijven.
  const huidigeUrl = `/dashboard/prospects?pagina=${huidigePagina}${statusQs}${zoekQs}${sortQs}${scanQs}`;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Prospects</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Link href="/dashboard/prospects/brieven" className="knop-primair">Brieven maken</Link>
          <Drawer
            knop="Importeer prospects"
            titel="Importeer prospects"
            beschrijving="Plak een lijst, één bedrijf per regel, kommagescheiden. Volgorde: bedrijfsnaam, contactpersoon, email, telefoon, branche, plaats, website, grootte. Een koprij wordt automatisch overgeslagen. Rijen zonder bedrijfsnaam slaan we over."
          >
            <form action={importeerCsvActie} className="mt-4 flex flex-col gap-3">
              <textarea
                name="csv"
                rows={6}
                placeholder="bedrijfsnaam, contactpersoon, email, telefoon, branche, plaats"
                className={`${inputCls} font-mono text-xs`}
              />
              <button type="submit" className="self-start knop-donker">Importeren</button>
            </form>
          </Drawer>
          <Drawer
            knop="Nieuwe prospect"
            titel="Nieuwe prospect"
            beschrijving="Eén bedrijf toevoegen. Alleen de bedrijfsnaam is verplicht."
          >
            <form action={nieuweProspectActie} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="veld-label">Bedrijfsnaam</label>
                <input name="bedrijfsnaam" required placeholder="Bedrijfsnaam" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Contactpersoon (optioneel)</label>
                <input name="contactpersoon" placeholder="Naam" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="veld-label">E-mail (optioneel)</label>
                  <input name="email" type="email" placeholder="naam@bedrijf.nl" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Telefoon (optioneel)</label>
                  <input name="telefoon" placeholder="06 12345678" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="veld-label">Branche (optioneel)</label>
                  <input name="branche" placeholder="Bijv. installatie" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Plaats (optioneel)</label>
                  <input name="plaats" placeholder="Bijv. Doetinchem" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="veld-label">Website (optioneel)</label>
                  <input name="website" placeholder="www.bedrijf.nl" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Grootte (optioneel)</label>
                  <input name="grootte" placeholder="Bijv. 10-25" className={inputCls} />
                </div>
              </div>
              <button type="submit" className="self-start knop-donker">Prospect aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Bedrijven die je wilt benaderen. Filter op status, zoek op naam of plaats, en houd per rij bij hoe ver je staat.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="veld-label">Status</label>
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
          {gescand && <input type="hidden" name="gescand" value={gescand} />}
          <label className="veld-label">Zoeken</label>
          <input name="zoek" defaultValue={zoek ?? ''} placeholder="Bedrijf, contactpersoon, e-mail of plaats" className={`${inputCls} min-w-[16rem]`} />
        </form>
        <div>
          <span className="veld-label">QR-code</span>
          <div className="flex gap-1.5">
            {([['', 'Alle'], ['ja', 'Gescand'], ['nee', 'Nog niet gescand']] as const).map(([w, l]) => (
              <Link
                key={w || 'alle'}
                href={`/dashboard/prospects?pagina=1${statusQs}${zoekQs}${sortQs}${w ? `&gescand=${w}` : ''}`}
                className={`chip ${(gescand ?? '') === w ? 'chip-aan' : ''}`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
        {(status || zoek || gescand) && <Link href="/dashboard/prospects" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </div>

      {melding === 'logos' && (
        <p className="mt-4 rounded-md border border-line bg-mist px-3 py-2 text-[13px] text-ink-800" role="status">
          Logo&apos;s ophalen klaar: {Number(gelukt) || 0} gevonden, {Number(mislukt) || 0} niet gelukt
          {Number(over) ? `, ${Number(over)} overgeslagen (al een logo of geen website)` : ''}
          {Number(rest) ? `, ${Number(rest)} niet meer aan toegekomen (start de actie nog een keer)` : ''}.
          Bekijk ze in de kolom Logo; per prospect kun je een ander logo kiezen.
        </p>
      )}

      {prospecten.length > 0 && (
        <form id="bulk-logos" action={bulkLogosOphalenActie} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="terug" value={huidigeUrl} />
          <VerzendKnop className="knop-stil" bezigTekst="Logo&apos;s zoeken… (kan een minuut duren)">Logo&apos;s ophalen voor selectie</VerzendKnop>
          <span className="text-[12px] text-warm">Vink rijen aan (max 20 per keer). Prospects met een logo slaan we over. Duurt tot een minuut.</span>
        </form>
      )}

        {prospecten.length === 0 ? (
          <EmptyState tekst="Geen prospects gevonden. Gebruik de knoppen rechtsboven om te importeren of er handmatig een toe te voegen." />
        ) : (
          <div className="panel">
            <table className="tbl">
              <thead className="thead-sticky">
                <tr>
                  <th className="w-8"><span className="sr-only">Selecteer</span></th>
                  <SortableTh label="Bedrijf" col="bedrijfsnaam" />
                  <SortableTh label="Plaats" col="plaats" />
                  <SortableTh label="Status" col="status" />
                  <SortableTh label="Gescand" col="laatste_scan_op" />
                  <SortableTh label="Brief verstuurd" col="brief_verstuurd_op" className="hidden md:table-cell" />
                  <th className="hidden lg:table-cell">Logo</th>
                  <SortableTh label="Toegevoegd" col="created_at" className="hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody>
                {prospecten.map((p) => (
                  <tr key={p.id} className="border-b border-line">
                    <td>
                      <input type="checkbox" name="ids" value={p.id} form="bulk-logos" aria-label={`Selecteer ${p.bedrijfsnaam}`} className="h-4 w-4 accent-amber-500" />
                    </td>
                    <td className="text-ink-900">
                      <Link href={`/dashboard/prospects/${p.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{p.bedrijfsnaam}</Link>
                      {(p.eigenaar || p.contactpersoon) && <span className="block text-xs text-warm">{p.eigenaar || p.contactpersoon}</span>}
                      {p.email && <span className="block text-xs text-warm">{p.email}</span>}
                    </td>
                    <td className="text-warm">{p.plaats || '-'}</td>
                    <td>
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
                    <td className="whitespace-nowrap">
                      {(p.aantal_scans ?? 0) > 0 ? (
                        <span className="badge-actie" title={`Laatste scan ${fmt(p.laatste_scan_op ?? null)}`}>{p.aantal_scans}× · {fmt(p.laatste_scan_op ?? null)}</span>
                      ) : (
                        <span className="text-warm">-</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap text-warm md:table-cell">{fmt(p.brief_verstuurd_op ?? null)}</td>
                    <td className="hidden lg:table-cell">
                      {p.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logo_url} alt={`Logo ${p.bedrijfsnaam}`} className="h-7 w-14 object-contain" />
                      ) : (
                        <span className="text-warm">-</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap text-warm sm:table-cell">{fmt(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {aantalPaginas > 1 && (
          <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
            {huidigePagina > 1 ? (
              <Link href={`/dashboard/prospects?pagina=${huidigePagina - 1}${statusQs}${zoekQs}${sortQs}${scanQs}`} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
            ) : <span />}
            <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
            {huidigePagina < aantalPaginas ? (
              <Link href={`/dashboard/prospects?pagina=${huidigePagina + 1}${statusQs}${zoekQs}${sortQs}${scanQs}`} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
            ) : <span />}
          </nav>
        )}
    </main>
  );
}
