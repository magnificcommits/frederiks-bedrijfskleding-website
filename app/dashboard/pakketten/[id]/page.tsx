import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getPakket, listPakketProducten, listProducten } from '@/lib/kms/pakketten';
import { werkPakket, voegProductToe, verwijderProductActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pakket', robots: { index: false, follow: false } };

const inputCls = 'veld';

export default async function PakketPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/pakketten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar pakketten</Link>
        </div>
      </main>
    );
  }

  const pakket = await getPakket(id);
  if (!pakket) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Pakket niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Dit pakket bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/pakketten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar pakketten</Link>
        </div>
      </main>
    );
  }

  const [regels, producten] = await Promise.all([listPakketProducten(id), listProducten()]);
  const terug = '/dashboard/pakketten?org=' + encodeURIComponent(pakket.organisatie_id);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">{pakket.naam}</h1>
          <p className="mt-1 text-sm text-warm">{pakket.soort === 'start' ? 'Startpakket' : 'Regulier pakket'}</p>
        </div>
        <Link href={terug} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar pakketten</Link>
      </div>

      {pakket.soort === 'start' && (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-3 text-sm text-warm">Dit is een startpakket. Een medewerker moet dit eerst bestellen voordat losse artikelen nabesteld kunnen worden.</p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Gegevens</h2>
        <form action={werkPakket} className="mt-4 grid gap-4 panel p-4 sm:grid-cols-2">
          <input type="hidden" name="pakketId" value={id} />
          <div className="sm:col-span-2">
            <label className="veld-label">Naam</label>
            <input name="naam" required defaultValue={pakket.naam} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Soort</label>
            <select name="soort" defaultValue={pakket.soort} className={inputCls}>
              <option value="regulier">Regulier pakket</option>
              <option value="start">Startpakket</option>
            </select>
            <p className="mt-1 text-xs text-warm">Een startpakket moet eerst besteld worden voordat losse artikelen kunnen.</p>
          </div>
          <div>
            <label className="veld-label">Pakketprijs</label>
            <input name="pakketprijs" inputMode="decimal" defaultValue={pakket.pakketprijs != null ? String(pakket.pakketprijs) : ''} placeholder="bedrag" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="buiten_budget" value="true" defaultChecked={pakket.buiten_budget} className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
            Buiten budget
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="actief" value="true" defaultChecked={pakket.actief} className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
            Actief
          </label>
          <div className="sm:col-span-2 flex items-end">
            <button type="submit" className="knop-donker">Gegevens opslaan</button>
          </div>
        </form>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Producten in het pakket</h2>
          <Drawer knop="Product toevoegen" titel="Product toevoegen">
            <form action={voegProductToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="pakketId" value={id} />
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
            <p className="mt-3 text-xs text-warm">Een toegevoegd product geldt voor alle varianten. De medewerker kiest bij het bestellen zelf maat en kleur.</p>
          </Drawer>
        </div>
          {regels.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen producten in dit pakket. Voeg er rechts een toe.</p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Aantal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {regels.map((r) => (
                    <tr key={r.id} className="border-b border-line">
                      <td className="font-semibold text-ink-900">{r.product_naam}{r.product_merk ? <span className="font-normal text-warm"> ({r.product_merk})</span> : null}</td>
                      <td className="text-warm">{r.variant_label || 'alle varianten'}</td>
                      <td className="text-warm">{r.aantal}</td>
                      <td className="text-right">
                        <form action={verwijderProductActie}>
                          <input type="hidden" name="pakketId" value={id} />
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
