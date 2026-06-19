import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listProductenPaged, listMerken, listLeveranciers } from '@/lib/kms/producten';
import { nieuwProduct } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Producten', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const PER_PAGINA = 25;

export default async function ProductenPage({ searchParams }: { searchParams: Promise<{ zoek?: string; merk?: string; pagina?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
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

  const { zoek, merk, pagina } = await searchParams;
  const huidigePagina = Math.max(1, Number(pagina) || 1);
  const [{ rijen: producten, totaal }, merken, leveranciers] = await Promise.all([
    listProductenPaged({ pagina: huidigePagina, perPagina: PER_PAGINA, zoek, merk }),
    listMerken(),
    listLeveranciers(),
  ]);
  const aantalPaginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const filterQs = `${zoek ? `&zoek=${encodeURIComponent(zoek)}` : ''}${merk ? `&merk=${encodeURIComponent(merk)}` : ''}`;

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Producten</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">De productcatalogus met varianten en prijzen. Klik op een product om het te bewerken.</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Zoeken</label>
          <input name="zoek" defaultValue={zoek ?? ''} placeholder="Naam, SKU, merk, categorie" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-warm">Merk</label>
          <select name="merk" defaultValue={merk ?? ''} className={inputCls}>
            <option value="">Alle merken</option>
            {merken.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Filteren</button>
        {(zoek || merk) && <Link href="/dashboard/producten" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {producten.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen producten gevonden. Voeg er rechts een toe.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Naam</th>
                    <th className="px-4 py-3">Merk</th>
                    <th className="px-4 py-3">Categorie</th>
                    <th className="px-4 py-3">Varianten</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {producten.map((p) => (
                    <tr key={p.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/producten/${p.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{p.naam}</Link>
                      </td>
                      <td className="px-4 py-3 text-warm">{p.merk || '-'}</td>
                      <td className="px-4 py-3 text-warm">{p.categorie || '-'}</td>
                      <td className="px-4 py-3 text-warm">{p.aantal_varianten}</td>
                      <td className="px-4 py-3">
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
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuw product</h2>
          <p className="mt-1 text-xs text-warm">Vul de basisgegevens in. Na opslaan ga je door naar de productpagina voor varianten, prijzen en afbeeldingen.</p>
          <form action={nieuwProduct} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Naam</label>
              <input name="naam" required placeholder="Bijv. Softshell jas" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Merk</label>
              <input name="merk" placeholder="Merk" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Categorie</label>
              <input name="categorie" placeholder="Bijv. Jassen" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Leverancier</label>
              <select name="leverancier_id" className={inputCls}>
                <option value="">Geen leverancier</option>
                {leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Btw (%)</label>
              <input name="btw" inputMode="decimal" defaultValue="21" className={inputCls} />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Product aanmaken</button>
          </form>
        </div>
      </div>
    </main>
  );
}
