import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getFunctie, listFunctieProducten, listProducten } from '@/lib/kms/functies';
import { voegProductToe, verwijderProductActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Functie', robots: { index: false, follow: false } };

const inputCls = 'veld';

export default async function FunctiePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/functies" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar functies</Link>
        </div>
      </main>
    );
  }

  const functie = await getFunctie(id);
  if (!functie) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Functie niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze functie bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/functies" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar functies</Link>
        </div>
      </main>
    );
  }

  const [regels, producten] = await Promise.all([listFunctieProducten(id), listProducten()]);
  const terug = '/dashboard/functies?org=' + encodeURIComponent(functie.organisatie_id);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">{functie.naam}</h1>
          <p className="mt-1 text-sm text-warm">Kledingpakket voor deze functiegroep.</p>
        </div>
        <Link href={terug} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar functies</Link>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Producten in het pakket</h2>
          <Drawer knop="Product toevoegen" titel="Product toevoegen">
            <form action={voegProductToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="functieId" value={id} />
              <div>
                <label className="veld-label">Product</label>
                <select name="productId" required className={inputCls}>
                  <option value="">Kies een product</option>
                  {producten.map((p) => (
                    <option key={p.id} value={p.id}>{p.merk ? `${p.naam} (${p.merk})` : p.naam}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="veld-label">Aantal</label>
                <input name="aantal" inputMode="numeric" defaultValue="1" className={inputCls} />
              </div>
              <button type="submit" className="self-start knop-donker">Toevoegen</button>
            </form>
          </Drawer>
        </div>
          {regels.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen producten gekoppeld. Voeg er rechts een toe.</p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Merk</th>
                    <th>Aantal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {regels.map((r) => (
                    <tr key={r.id} className="border-b border-line">
                      <td className="font-semibold text-ink-900">{r.product_naam}</td>
                      <td className="text-warm">{r.product_merk || '-'}</td>
                      <td className="text-warm">{r.aantal}</td>
                      <td className="text-right">
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
      </section>
    </main>
  );
}
