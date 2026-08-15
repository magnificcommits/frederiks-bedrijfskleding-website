import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listProductenPaged, listMerken, listLeveranciers } from '@/lib/kms/producten';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import SortableTh from '@/components/dashboard/SortableTh';
import EmptyState from '@/components/dashboard/EmptyState';
import { telProductenZonderFoto } from '@/lib/kms/tellingen';
import { nieuwProduct } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Producten', robots: { index: false, follow: false } };

const inputCls = 'veld';
const PER_PAGINA = 25;

export default async function ProductenPage({ searchParams }: { searchParams: Promise<{ zoek?: string; merk?: string; zonderfoto?: string; pagina?: string; sort?: string; dir?: string }> }) {
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

  const { zoek, merk, zonderfoto, pagina, sort, dir } = await searchParams;
  const alleenZonderFoto = zonderfoto === '1';
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const dirParam = dir === 'asc' ? 'asc' : dir === 'desc' ? 'desc' : undefined;
  const [{ rijen: producten, totaal }, merken, leveranciers, zonderFotoTotaal] = await Promise.all([
    listProductenPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek, merk, zonderFoto: alleenZonderFoto, sort, dir: dirParam }),
    listMerken(),
    listLeveranciers(),
    telProductenZonderFoto(),
  ]);
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const filterQs = `${zoek ? `&zoek=${encodeURIComponent(zoek)}` : ''}${merk ? `&merk=${encodeURIComponent(merk)}` : ''}${alleenZonderFoto ? '&zonderfoto=1' : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}${dirParam ? `&dir=${dirParam}` : ''}`;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Producten</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Nieuw product"
            titel="Nieuw product"
            beschrijving="Vul de basisgegevens in. Na opslaan ga je door naar de productpagina voor varianten, prijzen en afbeeldingen."
          >
            <form action={nieuwProduct} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="veld-label">Naam</label>
                  <input name="naam" required placeholder="Bijv. Softshell jas" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Merk</label>
                  <input name="merk" placeholder="Merk" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Categorie</label>
                  <input name="categorie" placeholder="Bijv. Jassen" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Leverancier</label>
                  <select name="leverancier_id" className={inputCls}>
                    <option value="">Geen leverancier</option>
                    {leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="veld-label">Btw (%)</label>
                  <input name="btw" inputMode="decimal" defaultValue="21" className={inputCls} />
                </div>
                <button type="submit" className="self-start knop-donker">Product aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">De productcatalogus met varianten en prijzen. Klik op een product om het te bewerken.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        {/* Zoeken blijft een tekstveld met submit (per toetsaanslag auto-submitten zou een debounce vergen).
            Het actieve merk reist mee als hidden veld zodat zoeken het merkfilter behoudt. */}
        <form method="get" className="flex items-end gap-3">
          <div>
            <label className="veld-label">Zoeken</label>
            <input name="zoek" defaultValue={zoek ?? ''} placeholder="Naam, SKU, merk, categorie" className={inputCls} />
          </div>
          {merk && <input type="hidden" name="merk" value={merk} />}
          <button type="submit" className="knop-donker">Zoeken</button>
        </form>
        {/* Merk auto-navigeert (geen aparte knop). De zoekterm reist mee via de param-injectie. */}
        <div>
          <label className="veld-label">Merk</label>
          <NavigateSelect
            basePath="/dashboard/producten"
            param={zoek ? `zoek=${encodeURIComponent(zoek)}&merk` : 'merk'}
            value={merk ?? ''}
            placeholder="Alle merken"
            className={inputCls}
            options={merken.map((m) => ({ value: m, label: m }))}
          />
        </div>
        {/* Werklijst: welke producten missen nog een foto? Zonder foto verkoopt het niet. */}
        <Link
          href={alleenZonderFoto ? `/dashboard/producten${zoek ? `?zoek=${encodeURIComponent(zoek)}` : ''}` : `/dashboard/producten?zonderfoto=1${zoek ? `&zoek=${encodeURIComponent(zoek)}` : ''}`}
          className={`chip self-end ${alleenZonderFoto ? 'chip-aan' : ''}`}
        >
          Zonder foto
          <span className="chip-tel">{zonderFotoTotaal}</span>
        </Link>
        <a
          href={`/dashboard/producten/export?${new URLSearchParams({ ...(alleenZonderFoto ? { zonderfoto: '1' } : {}), ...(merk ? { merk } : {}) })}`}
          className="knop-stil self-end"
          title="Download deze selectie als CSV, met een lege kolom voor foto-URL's"
        >
          Exporteer
        </a>
        {(zoek || merk || alleenZonderFoto) && <Link href="/dashboard/producten" className="knop-tekst self-end">Wissen</Link>}
      </div>

        {producten.length === 0 ? (
          <EmptyState tekst="Geen producten gevonden. Voeg er rechtsboven een toe." />
        ) : (
          <div className="panel">
            <table className="tbl">
              <thead className="thead-sticky">
                <tr>
                  <SortableTh label="Naam" col="naam" />
                  <SortableTh label="Merk" col="merk" />
                  <SortableTh label="Categorie" col="categorie" className="hidden sm:table-cell" />
                  <th className="hidden sm:table-cell">Varianten</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {producten.map((p) => (
                  <tr key={p.id} className="border-b border-line">
                    <td>
                      <Link href={`/dashboard/producten/${p.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{p.naam}</Link>
                    </td>
                    <td className="text-warm">{p.merk || '-'}</td>
                    <td className="hidden text-warm sm:table-cell">{p.categorie || '-'}</td>
                    <td className="hidden text-warm sm:table-cell">{p.aantal_varianten}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${p.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{p.actief ? 'actief' : 'inactief'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {aantalPaginas > 1 && (
          <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Paginering">
            {huidigePagina > 1 ? (
              <Link href={`/dashboard/producten?pagina=${huidigePagina - 1}${filterQs}`} className="font-semibold text-warm hover:text-ink-800">Vorige</Link>
            ) : <span />}
            <span className="text-warm">Pagina {huidigePagina} van {aantalPaginas}</span>
            {huidigePagina < aantalPaginas ? (
              <Link href={`/dashboard/producten?pagina=${huidigePagina + 1}${filterQs}`} className="font-semibold text-warm hover:text-ink-800">Volgende</Link>
            ) : <span />}
          </nav>
        )}
    </main>
  );
}
