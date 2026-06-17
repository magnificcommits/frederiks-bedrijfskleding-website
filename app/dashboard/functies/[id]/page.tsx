import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getFunctie, listFunctieProducten, listProducten } from '@/lib/kms/functies';
import { voegProductToe, verwijderProductActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Functie', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function FunctiePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/functies" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar functies</Link>
        </div>
      </main>
    );
  }

  const functie = await getFunctie(id);
  if (!functie) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Functie niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze functie bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/functies" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar functies</Link>
        </div>
      </main>
    );
  }

  const [regels, producten] = await Promise.all([listFunctieProducten(id), listProducten()]);
  const terug = '/dashboard/functies?org=' + encodeURIComponent(functie.organisatie_id);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{functie.naam}</h1>
          <p className="mt-1 text-sm text-warm">Kledingpakket voor deze functiegroep.</p>
        </div>
        <Link href={terug} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar functies</Link>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Producten in het pakket</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {regels.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen producten gekoppeld. Voeg er rechts een toe.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Merk</th>
                      <th className="px-4 py-3">Aantal</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {regels.map((r) => (
                      <tr key={r.id} className="border-b border-line">
                        <td className="px-4 py-3 font-semibold text-ink-900">{r.product_naam}</td>
                        <td className="px-4 py-3 text-warm">{r.product_merk || '-'}</td>
                        <td className="px-4 py-3 text-warm">{r.aantal}</td>
                        <td className="px-4 py-3 text-right">
                          <form action={verwijderProductActie}>
                            <input type="hidden" name="functieId" value={id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <ConfirmSubmit message="Dit product uit het pakket verwijderen?" className="text-xs font-semibold text-red-700 hover:text-red-800">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">Product toevoegen</h3>
            <form action={voegProductToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="functieId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Product</label>
                <select name="productId" required className={inputCls}>
                  <option value="">Kies een product</option>
                  {producten.map((p) => (
                    <option key={p.id} value={p.id}>{p.merk ? `${p.naam} (${p.merk})` : p.naam}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Aantal</label>
                <input name="aantal" inputMode="numeric" defaultValue="1" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
